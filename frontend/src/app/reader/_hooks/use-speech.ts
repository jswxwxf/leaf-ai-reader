import { useReaderStore, useReaderStoreRaw, type ReaderStore, type SpeechMode } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { scrollIntoViewIfNeeded } from "../_utils/utils";
import { useWordHighlight } from "./use-word-highlight";
import { useWakeLock } from "./use-wake-lock";
import { systemSpeechEngine } from "../_engines/system-speech-engine";
import { kokoroEngine } from "../_engines/kokoro-engine";
import type { SpeechEngine } from "../_engines/engine";
import { showToast } from "@/app/global-toasts";

export { configureSpeech, sanitizeSpeechText } from "../_engines/system-speech-engine";

const engines = { "zh-CN": systemSpeechEngine, "en-US": kokoroEngine };

function stopEngines() {
  for (const engine of Object.values(engines)) {
    engine.stop();
  }
}

// 同一个 Reader 的播放和停止入口共享会话编号。
let speechSession = 0;

function getNextSentence(
  container: HTMLElement,
  currentId: string,
  delta: number = 1
): HTMLElement | undefined {
  const sentences = Array.from(container.querySelectorAll('.sentence'));
  const currentIndex = sentences.findIndex(el => el.id === currentId);
  return sentences[currentIndex + delta] as HTMLElement | undefined;
}

function prepareNextSentence(engine: SpeechEngine, container: HTMLElement, currentId: string) {
  const nextSentence = getNextSentence(container, currentId);
  if (!nextSentence) return;

  const nextText = engine.getText(nextSentence);
  if (nextText) void engine.prepare?.(nextText);
}

/**
 * 语音朗读核心逻辑 Hook
 */
export function useSpeech() {
  const store = useReaderStoreRaw();
  const {
    speechSentenceId,
    setSpeechSentenceId,
    isPlaying,
    setIsPlaying,
    contentRef,
  } = useReaderStore(
    useShallow((state) => ({
      speechSentenceId: state.speechSentenceId,
      setSpeechSentenceId: state.setSpeechSentenceId,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      contentRef: state.contentRef,
    }))
  );

  const { highlightWord, clearHighlight } = useWordHighlight();
  const { requestWakeLock, releaseWakeLock } = useWakeLock(isPlaying);

  // 按 DOM 顺序定位下一句，避免依赖连续编号。
  const moveToNextSentence = (container: HTMLElement, currentId: string) => {
    const nextSentence = getNextSentence(container, currentId);
    if (!nextSentence) {
      // 已到当前文章或章节末尾，释放屏幕唤醒锁。
      releaseWakeLock();
      return false;
    }

    setSpeechSentenceId(nextSentence.id);
    return true;
  };

  const play = async () => {
    const sessionId = ++speechSession;
    const isCurrentSession = () => sessionId === speechSession;
    const continuePlay = () => {
      setTimeout(() => {
        if (isCurrentSession()) void play();
      }, 0);
    };

    // 朗读开始时，申请保持屏幕唤醒
    requestWakeLock();

    // 定时续播可能持有旧的 play，从 store 直接读取最新句子位置。
    const targetId = store.getState().speechSentenceId ?? "s-1";
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
      if (!moveToNextSentence(container, targetId)) return;
      const currentSpeechMode = store.getState().speechMode;
      if (currentSpeechMode !== "paragraph" || !isLastSentenceInParagraph(el as HTMLElement)) {
        continuePlay();
      }
      return;
    }

    // 停止当前正在进行的朗读并清理旧高亮
    stopEngines();

    setIsPlaying(true);
    clearHighlight();

    // 续播定时器保留的是创建它时的 play 函数。若在 Hook 顶部读取 language，
    // 这个函数就会一直读到那次渲染的语言，即使用户已经切换。
    // 每句开始时直接读取 store，让下一句使用用户最新选择的语言。
    const engine = engines[store.getState().language];

    // 词级高亮逻辑 (通过抽取出的 hook 处理)
    const handleBoundary = (event: SpeechSynthesisEvent) => {
      if (!isCurrentSession()) return;
      if (event.name !== 'word') return;
      highlightWord(el, event.charIndex, event.charLength);
    };

    // 当这一句读完时，根据朗读模式决定是否继续播放下一句
    const handleEnd = () => {
      if (!isCurrentSession()) return;

      setIsPlaying(false);
      clearHighlight();

      const container = contentRef?.current;
      if (!container) return;

      // 先将焦点移到下一句，再读取最新模式，以响应播放期间的模式切换。
      if (moveToNextSentence(container, targetId) && shouldContinue(store.getState().speechMode, el)) {
        continuePlay();
      }
    };

    // 执行播放、确保当前高亮
    const options = {
      text: engine.getText(el),
      isCurrentSession,
      onBoundary: handleBoundary,
      onEnd: handleEnd,
      onError: (error: unknown) => {
        if (!isCurrentSession()) return;
        stop();
        console.warn("朗读失败", error);
        showToast({ message: "朗读失败，请重试。", type: "error" });
      },
    };
    const playbackPromise = engine.speak(options);

    // --- 核心优化：按需强制滚动 ---
    scrollIntoViewIfNeeded(el);

    if (speechSentenceId !== targetId) {
      setSpeechSentenceId(targetId);
    }

    if (!engine.prepare) return;
    // 等当前句启动播放且释放点播优先标记，再交给引擎预合成下一句。
    await playbackPromise;
    if (!isCurrentSession()) return;

    prepareNextSentence(engine, container, targetId);
  };

  const stop = () => {
    stopSpeech(store);
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

  return { play, step, stop, speechSentenceId, isPlaying };
}

export function stopSpeech(store: ReaderStore) {
  speechSession += 1;
  // 停止当前朗读并清除词级高亮
  stopEngines();
  store.getState().setIsPlaying(false);
  globalThis.CSS?.highlights?.get("word-focus")?.clear();
}

/** 根据当前朗读模式，判断这一句播完后是否自动续读。 */
function shouldContinue(mode: SpeechMode, sentence: HTMLElement): boolean {
  switch (mode) {
    case 'sentence':
      // 逐句模式通常读完就停，段内不超过 3 个字符的短句自动连读。
      return (sentence.textContent?.trim().length ?? 0) <= 3 && !isLastSentenceInParagraph(sentence);
    case 'paragraph':
      // 逐段模式在当前段落的最后一句停下。
      return !isLastSentenceInParagraph(sentence);
    case 'article':
      // 全文模式只要还有下一句就继续。
      return true;
  }
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
