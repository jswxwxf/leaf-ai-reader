import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { scrollIntoViewIfNeeded, isSafari } from "../_utils/utils";
import { useWordHighlight } from "./use-word-highlight";
import { useEffect, useRef } from "react";

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
  } = useReaderStore(
    useShallow((state) => ({
      speechSentenceId: state.speechSentenceId,
      setSpeechSentenceId: state.setSpeechSentenceId,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      speechMode: state.speechMode,
    }))
  );

  const { highlightWord, clearHighlight } = useWordHighlight();

  // 用 ref 持有最新值，确保 onend 等异步回调中读取不受闭包陈旧值影响
  const speechSentenceIdRef = useRef(speechSentenceId);
  useEffect(() => {
    speechSentenceIdRef.current = speechSentenceId;
  }, [speechSentenceId]);

  const play = () => {
    // 1. 确定当前要读的句子（始终从 ref 读取最新值）
    const targetId = speechSentenceIdRef.current ?? "s-1";
    const el = document.getElementById(targetId);

    if (!el || !el.textContent) {
      console.warn(`未找到目标句子 (${targetId})`);
      return;
    }

    // 如果全是标点符号则跳过，递归调用 play 直到读到实质内容或触及边界
    if (!/[^\p{P}\p{S}\s]/u.test(el.textContent)) {
      setSpeechSentenceId(`s-${parseInt(targetId.replace("s-", "")) + 1}`);
      if (speechMode !== "paragraph" || !isLastSentenceInParagraph(el as HTMLElement)) {
        setTimeout(play, 0);
      }
      return;
    }

    // 2. 停止当前正在进行的朗读并清理旧高亮
    window.speechSynthesis.cancel();
    setIsPlaying(true);
    clearHighlight();

    // 3. 创建朗读任务 (对标点进行处理，防止 TTS 误读并引导停顿)
    // 注意：采用 1:1 或 2:2 替换以保持字符串长度不变，确保 onboundary 的 charIndex 索引不位移
    const processedText = el.textContent
      .replaceAll('——', '--')
      .replaceAll('”“', '”，')
      .replaceAll('"', ' '); // 仅处理会产生噪音的半角双引号，保持长度对齐
    const utterance = new SpeechSynthesisUtterance(processedText);

    // 适配不同浏览器的朗读倍速差异 (Safari 的 rate 基准通常比 Chrome/Edge 快)
    utterance.rate = isSafari ? 1.3 : 2;

    // 3.1 词级高亮逻辑 (通过抽取出的 hook 处理)
    utterance.onboundary = (event) => {
      if (event.name !== 'word') return;
      // @ts-ignore
      highlightWord(el, event.charIndex, event.charLength);
    };

    // 4. 当这一句读完时，根据朗读模式决定是否继续播放下一句
    utterance.onend = () => {
      setIsPlaying(false);
      clearHighlight();

      const currentNum = parseInt(targetId.replace("s-", ""));
      const nextId = `s-${currentNum + 1}`;
      const nextEl = document.getElementById(nextId);

      // 已到文章末尾，无需任何操作
      if (!nextEl) return;

      // 无论哪种模式，都将焦点移至下一句（确保用户手动播放时从下一句开始）
      setSpeechSentenceId(nextId);

      if (speechMode === 'sentence') {
        // 逐句模式：停止，不自动触发下一句播放
        return;
      }

      if (speechMode === 'paragraph') {
        // 逐段模式：判断当前句是否为该段落中的最后一句
        if (isLastSentenceInParagraph(el as HTMLElement)) {
          // 段落已结束，停止播放
          return;
        }
        // 段落未完，接力播放下一句（微延迟确保合成器状态已重置）
        setTimeout(play, 0);
        return;
      }

      if (speechMode === 'article') {
        // 全文模式：无条件跨段接力朗读
        setTimeout(play, 0);
      }
    };

    // 5. 执行播放、确保当前高亮
    window.speechSynthesis.speak(utterance);

    // --- 核心优化：按需强制滚动 ---
    scrollIntoViewIfNeeded(el);

    if (speechSentenceId !== targetId) {
      setSpeechSentenceId(targetId);
    }
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    clearHighlight();
  };

  const step = (delta: number) => {
    stop();
    let currentNum = 0;
    if (speechSentenceId) {
      currentNum = parseInt(speechSentenceId.replace("s-", ""));
    }

    const nextNum = Math.max(1, currentNum + delta);
    const nextId = `s-${nextNum}`;

    if (document.getElementById(nextId)) {
      setSpeechSentenceId(nextId);
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