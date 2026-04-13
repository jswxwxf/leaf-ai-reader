import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { scrollIntoViewIfNeeded, isSafari } from "../_utils/utils";
import { useWordHighlight } from "./use-word-highlight";

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

    // 3. 创建朗读任务 (对破折号做特殊处理，引导 TTS 引擎停顿)
    const processedText = el.textContent.replaceAll('——', '--');
    const utterance = new SpeechSynthesisUtterance(processedText);

    // 适配不同浏览器的朗读倍速差异 (Safari 的 rate 基准通常比 Chrome/Edge 快)
    utterance.rate = isSafari ? 1.4 : 2.1;

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

  const step = (delta: number) => {
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

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    clearHighlight();
  };

  return { play, step, stop, speechSentenceId, isPlaying };
}
