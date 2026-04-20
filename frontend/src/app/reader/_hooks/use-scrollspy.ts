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
    const visibleIds = new Set<string>(); // 追踪当前屏幕内所有可见的摘要点 ID

    const observer = new IntersectionObserver(
      (entries) => {
        // 手动按钮滚动期间不自动更新侧边栏焦点
        if (isManualScrolling) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id);
          } else {
            visibleIds.delete(entry.target.id);
          }
        });

        // 竞争逻辑：在所有当前可见的摘要点中，找到文档顺序最靠后的那一个
        // 这样可以保证高亮总是跟随阅读到的最新进度，且不会发生回退和跳变
        let latestId = null;
        for (let i = summaries.length - 1; i >= 0; i--) {
          const id = summaries[i].start_sId;
          if (visibleIds.has(id)) {
            latestId = id;
            break;
          }
        }

        if (latestId) {
          setSummarySentenceId(latestId);
        }
      },
      {
        root: null,
        rootMargin: "0px", // 只要进入视野即参与竞争
        threshold: [0],
      }
    );

    summaries.forEach((s) => {
      const el = container.querySelector(`[id="${s.start_sId}"]`);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      visibleIds.clear();
    };
  }, [summaries, setSummarySentenceId, content, isManualScrolling, contentRef]);
}
