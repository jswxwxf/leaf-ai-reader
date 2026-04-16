import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "../_store/store";

/**
 * 核心滚动监听 Hook (Scrollspy)
 * 仅仅负责监控位置并更新侧边栏摘要的高亮，不干涉朗读状态
 */
export function useScrollspy() {
  const {
    summaries,
    setSummarySentenceId,
    isManualScrolling,
    content,
    contentRef,
  } = useReaderStore(
    useShallow((state) => ({
      summaries: state.summaries,
      setSummarySentenceId: state.setSummarySentenceId,
      isManualScrolling: state.isManualScrolling,
      content: state.content,
      contentRef: state.contentRef,
    }))
  );

  useEffect(() => {
    if (summaries.length === 0 || !contentRef?.current) return;

    const container = contentRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        // 手动滚动期间不更新侧边栏焦点
        if (isManualScrolling) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSummarySentenceId(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: "-20% 0px -60% 0px", // 集中在屏幕中上方区域触发
        threshold: [0],
      }
    );

    summaries.forEach((s) => {
      const el = container.querySelector(`[id="${s.start_sId}"]`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [summaries, setSummarySentenceId, content, isManualScrolling, contentRef]);
}
