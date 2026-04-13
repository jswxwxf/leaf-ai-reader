"use client";

import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";

/**
 * 封装阅读器常用的复合动作和逻辑
 */
export function useReader() {
  const { setSummarySentenceId, setSpeechSentenceId, setIsManualScrolling, setIsPlaying } = useReaderStore(
    useShallow((state) => ({
      setSummarySentenceId: state.setSummarySentenceId,
      setSpeechSentenceId: state.setSpeechSentenceId,
      setIsManualScrolling: state.setIsManualScrolling,
      setIsPlaying: state.setIsPlaying,
    }))
  );

  /**
   * 跳转到指定句子
   * 包含：状态同步、自动滚动(可选)、语音停止、高亮清理、滚动锁定(可选)
   */
  const jumpToSentence = (sId: string, options: { scroll?: boolean } = { scroll: true }) => {
    // 1. 停止当前正在进行的朗读并清除词级高亮
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      if (typeof CSS !== "undefined" && (CSS as any).highlights) {
        (CSS as any).highlights.get("word-focus")?.clear();
      }
    }

    // 2. 同时更新两个 ID，并锁定滚动同步
    // isManualScrolling 防止在平滑滚动过程中 useScrollspy 又反向改写汇总栏状态
    setIsManualScrolling(true);
    setIsPlaying(false);
    setSummarySentenceId(sId);
    setSpeechSentenceId(sId);

    const el = document.getElementById(sId);
    const unlock = () => setIsManualScrolling(false);

    // 3. 元素不存在时直接解锁
    if (!el) {
      unlock();
      return;
    }

    // 4. 如果不需要滚动，直接更新状态并解锁
    if (!options.scroll) {
      unlock();
      return;
    }

    // 5. 执行平滑滚动 (居中显示)
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // 6. 滚动结束后的解锁逻辑
    const container = el.closest("section"); // 查找滚动容器
    const hasScrollEnd = "onscrollend" in window || (window as any).onscrollend !== undefined;

    // 兜底：若浏览器不支持 scrollend 事件或找不到容器，使用定时器解锁
    if (!container || !hasScrollEnd) {
      setTimeout(unlock, 1000);
      return;
    }

    // 监听 scrollend 事件，确保滚动完全停止后才允许 scrollspy 恢复工作
    const handleScrollEnd = () => {
      unlock();
      container.removeEventListener("scrollend", handleScrollEnd);
    };
    container.addEventListener("scrollend", handleScrollEnd);
  };

  return {
    jumpToSentence,
  };
}
