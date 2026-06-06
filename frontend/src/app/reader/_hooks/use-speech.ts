import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { scrollIntoViewIfNeeded, isSafari } from "../_utils/utils";
import { useWordHighlight } from "./use-word-highlight";
import { useEffect, useRef } from "react";
import { useWakeLock } from "./use-wake-lock";
import { useSpeechRetry } from "./use-speech-retry";

/**
 * 清洗 TTS 输入文本，过滤引文序号、emoji 和不适合直接朗读的符号。
 */
export function sanitizeSpeechText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/https?:\/\//g, (m) => " ".repeat(m.length))
    .replace(/\[\d+\]|〔\d+〕|【\d+】|\(\d+\)|[①-⑳⑴-⒇]/g, (m) => " ".repeat(m.length))
    .replace(/([0-9])\uFE0F?\u20E3/g, (m, digit: string) => digit + " ".repeat(m.length - digit.length))
    .replace(/\p{Extended_Pictographic}/gu, (m) => " ".repeat(m.length))
    .replace(/<([^<>]{1,120})>/g, (_m, inner: string) => ` ${inner} `)
    .replace(/""/g, "， ")
    .replace(/["']/g, " ")
    .replaceAll("——", "， ")
    .replace(/”“|」「|》《/g, "”，");
}

export function configureSpeech(utterance: SpeechSynthesisUtterance) {
  utterance.lang = "zh-CN";
  // 适配不同浏览器的朗读倍速差异 (Safari 的 rate 基准通常比 Chrome/Edge 快)
  utterance.rate = isSafari ? 1.32 : 2;
}

/**
 * 获取元素的文本内容，并将特定标签（如 sup, sub）的内容替换为等长空格。
 * 目的是在 TTS 朗读时静音跳过这些引文，同时保持字符偏移量不变，确保高亮精准。
 */
function getTextWithMasking(node: Node): string {
  let text = "";

  // 通过 for...of 配合 continue 扁平化处理逻辑，消除嵌套深坑
  for (const child of Array.from(node.childNodes)) {
    // 1. 处理纯文本节点
    if (child.nodeType === Node.TEXT_NODE) {
      text += sanitizeSpeechText(child.textContent || "");
      continue;
    }

    // 2. 忽略非元素节点
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    // 3. 处理注脚类标签 (SUP/SUB)
    const isNote = child.nodeName === "SUP" || child.nodeName === "SUB";
    if (isNote) {
      const content = child.textContent || "";
      // 智能阈值：文字够长则清洗后朗读，较短（通常为序号）则静音填充
      text +=
        content.length > 8 ? sanitizeSpeechText(content) : " ".repeat(content.length);
      continue;
    }

    // 4. 处理普通元素节点（递归）
    text += getTextWithMasking(child);
  }

  return text.toLowerCase();
}

function getNextSentence(
  container: HTMLElement,
  currentId: string,
  delta: number = 1
): HTMLElement | undefined {
  const sentences = Array.from(container.querySelectorAll('.sentence'));
  const currentIndex = sentences.findIndex(el => el.id === currentId);
  return sentences[currentIndex + delta] as HTMLElement | undefined;
}

/**
 * 语音朗读核心逻辑 Hook
 */
export function useSpeech() {
  const {
    speechSentenceId,
    setSpeechSentenceId,
    isPlaying,
    setIsPlaying,
    speechMode,
    contentRef,
  } = useReaderStore(
    useShallow((state) => ({
      speechSentenceId: state.speechSentenceId,
      setSpeechSentenceId: state.setSpeechSentenceId,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      speechMode: state.speechMode,
      contentRef: state.contentRef,
    }))
  );

  const { highlightWord, clearHighlight } = useWordHighlight();
  const { requestWakeLock, releaseWakeLock } = useWakeLock(isPlaying);
  const { speakWithRetry } = useSpeechRetry({ enabled: isSafari });
  const speechSessionRef = useRef(0);

  // 用 ref 持有最新值，确保 onend 等异步回调中读取不受闭包陈旧值影响
  const speechSentenceIdRef = useRef(speechSentenceId);
  useEffect(() => {
    speechSentenceIdRef.current = speechSentenceId;
  }, [speechSentenceId]);

  // 朗读模式会在设置面板中途切换；onend/setTimeout 这类异步回调必须读取最新模式。
  const speechModeRef = useRef(speechMode);
  useEffect(() => {
    speechModeRef.current = speechMode;
  }, [speechMode]);

  const play = async () => {
    // 朗读开始时，申请保持屏幕唤醒
    requestWakeLock();

    // 1. 确定当前要读的句子（始终从 ref 读取最新值）
    const targetId = speechSentenceIdRef.current ?? "s-1";
    const container = contentRef?.current;
    if (!container) {
      releaseWakeLock();
      return;
    }

    // 从当前阅读器容器内进行局部查找，避免 ID 冲突
    const el = container.querySelector(`[id="${targetId}"]`) as HTMLElement;

    if (!el || !el.textContent) {
      console.warn(`未找到目标句子 (${targetId})`);
      releaseWakeLock(); // 出错或找不到时考虑释放
      return;
    }

    // 如果全是标点符号、符号或 emoji 则跳过，递归调用 play 直到读到实质内容或触及边界
    if (!/[^\p{P}\p{S}\s\p{Extended_Pictographic}]/u.test(el.textContent)) {
      const nextEl = getNextSentence(container, targetId);

      if (!nextEl) {
        releaseWakeLock();
        return;
      }

      setSpeechSentenceId(nextEl.id);
      const currentSpeechMode = speechModeRef.current;
      if (currentSpeechMode !== "paragraph" || !isLastSentenceInParagraph(el as HTMLElement)) {
        setTimeout(play, 0);
      }
      return;
    }

    // 2. 停止当前正在进行的朗读并清理旧高亮
    window.speechSynthesis.cancel();
    // iOS Safari 的 cancel 是异步的，留出清理时间避免竞争导致随机跳过字符或句子
    // if (isSafari) await delay(50);

    setIsPlaying(true);
    clearHighlight();
    const sessionId = (speechSessionRef.current += 1);

    // 3. 创建朗读任务
    // 使用 getTextWithMasking 自动完成引文静音、Emoji 过滤及标点归一化
    // 该函数保证了 1:1 的替换比例，确保 onboundary 的 charIndex 获取到精准的高亮坐标
    const processedText = getTextWithMasking(el);
    const isCurrentSession = () => speechSessionRef.current === sessionId;

    // 3.1 词级高亮逻辑 (通过抽取出的 hook 处理)
    const handleBoundary = (event: SpeechSynthesisEvent) => {
      if (!isCurrentSession()) return;
      if (event.name !== 'word') return;
      highlightWord(el, event.charIndex, event.charLength);
    };

    // 4. 当这一句读完时，根据朗读模式决定是否继续播放下一句
    const handleEnd = () => {
      if (!isCurrentSession()) return;

      setIsPlaying(false);
      clearHighlight();

      const container = contentRef?.current;
      if (!container) return;

      // 寻找下一个句子的 ID (不再依赖 ID+1，而是基于 DOM 顺序)
      const nextEl = getNextSentence(container, targetId);

      // 已到文章末尾，停止播放并释放锁
      if (!nextEl) {
        releaseWakeLock();
        return;
      }

      const nextId = nextEl.id;
      // 这里读取 ref，确保用户在当前句朗读过程中切换模式后，本次结束决策立即生效。
      const currentSpeechMode = speechModeRef.current;

      // 无论哪种模式，都将焦点移至下一句
      setSpeechSentenceId(nextId);

      if (currentSpeechMode === 'sentence') {
        // 逐句模式：如果当前句太短（小于等于3个字）且不在段落末尾，则自动连读下一句
        const isShort = (el.textContent?.trim().length || 0) <= 3;
        const isLastInPara = isLastSentenceInParagraph(el as HTMLElement);

        if (isShort && !isLastInPara) {
          setTimeout(play, 0);
        }
        return;
      }

      if (currentSpeechMode === 'paragraph') {
        // 逐段模式：判断是否为段落末尾
        if (isLastSentenceInParagraph(el as HTMLElement)) {
          return;
        }
        // 段落未完，接力播放
        setTimeout(play, 0);
        return;
      }

      if (currentSpeechMode === 'article') {
        // 全文模式：接力播放
        setTimeout(play, 0);
      }
    };

    // 5. 执行播放、确保当前高亮
    speakWithRetry({
      text: processedText,
      isCurrentSession,
      configure: (utterance) => {
        configureSpeech(utterance);
      },
      onBoundary: handleBoundary,
      onEnd: handleEnd,
    });

    // --- 核心优化：按需强制滚动 ---
    scrollIntoViewIfNeeded(el);

    if (speechSentenceId !== targetId) {
      setSpeechSentenceId(targetId);
    }
  };

  const stop = () => {
    speechSessionRef.current += 1;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    clearHighlight();
    releaseWakeLock();
  };

  const step = (delta: number) => {
    stop();
    const container = contentRef?.current;
    if (!container || !speechSentenceId) return;

    const nextEl = getNextSentence(container, speechSentenceId, delta);

    if (nextEl) {
      setSpeechSentenceId(nextEl.id);
    }
  };

  useShortKey({ isPlaying, play, stop, step });

  return { play, step, stop, speechSentenceId, isPlaying };
}

/**
 * 键盘快捷键监听 Hook
 */
function useShortKey({
  isPlaying,
  play,
  stop,
  step,
}: {
  isPlaying: boolean;
  play: () => void;
  stop: () => void;
  step: (delta: number) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果焦点在输入元素上，不触发快捷键
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault(); // 防止页面滚动
        if (isPlaying) {
          stop();
        } else {
          play();
        }
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, play, stop]);
}

export function stopSpeech(store: any) {
  // 停止当前朗读并清除词级高亮
  window.speechSynthesis?.cancel();
  store.getState().setIsPlaying(false);
  (CSS as any).highlights?.get("word-focus")?.clear();
}

/**
 * 判断当前句子元素是否为其所属段落的最后一个句子
 */
function isLastSentenceInParagraph(el: HTMLElement): boolean {
  const container = el.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
  if (!container) return true; // 如果找不到容器，保守起见视为段落结束

  const sentencesInContainer = container.querySelectorAll('.sentence');
  return sentencesInContainer.length > 0 &&
    sentencesInContainer[sentencesInContainer.length - 1] === el;
}
