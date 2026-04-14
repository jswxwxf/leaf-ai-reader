import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { scrollIntoViewIfNeeded, isSafari } from "../_utils/utils";
import { useWordHighlight } from "./use-word-highlight";
import { useEffect } from "react";

/**
 * 语音朗读核心逻辑 Hook
 */
export function useSpeech() {
  const {
    speechSentenceId,
    setSpeechSentenceId,
    isPlaying,
    setIsPlaying,
  } = useReaderStore(
    useShallow((state) => ({
      speechSentenceId: state.speechSentenceId,
      setSpeechSentenceId: state.setSpeechSentenceId,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
    }))
  );

  const { highlightWord, clearHighlight } = useWordHighlight();

  const play = () => {
    // 1. 确定当前要读的句子
    const targetId = speechSentenceId || "s-1";
    const el = document.getElementById(targetId);

    if (!el || !el.textContent) {
      console.warn(`未找到目标句子 (${targetId})`);
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
    utterance.rate = isSafari ? 1.4 : 2;

    // 3.1 词级高亮逻辑 (通过抽取出的 hook 处理)
    utterance.onboundary = (event) => {
      if (event.name !== 'word') return;
      // @ts-ignore
      highlightWord(el, event.charIndex, event.charLength);
    };

    // 4. 重要：当这一句读完时，自动将高亮“接力”给下一句
    utterance.onend = () => {
      setIsPlaying(false);
      clearHighlight();

      const currentNum = parseInt(targetId.replace("s-", ""));
      const nextId = `s-${currentNum + 1}`;
      // 检查下一句是否存在，存在则更新 ID 触发 Scroller 滚动和高亮
      if (document.getElementById(nextId)) {
        setSpeechSentenceId(nextId);
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