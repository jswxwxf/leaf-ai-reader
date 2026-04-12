import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "../_store/store";

/**
 * 核心滚动监听 Hook (Scrollspy)
 * 负责监控正文句子锚点并同步更新 Store 中的活跃 ID
 */
export function useScrollspy() {
  const { 
    summaries, 
    setActiveSentenceId, 
    isManualScrolling,
    content 
  } = useReaderStore(
    useShallow((state) => ({
      summaries: state.summaries,
      setActiveSentenceId: state.setActiveSentenceId,
      isManualScrolling: state.isManualScrolling,
      content: state.content,
    }))
  );

  useEffect(() => {
    if (summaries.length === 0) return;

    // 创建观察者：监控元素进入视口上部区域
    const observer = new IntersectionObserver(
      (entries) => {
        // 如果当前是手动点击触发的滚动，则忽略观察者更新，防止路径上的摘要闪烁
        if (isManualScrolling) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSentenceId(entry.target.id);
          }
        });
      },
      {
        root: null,
        // rootMargin 为 0px 0px -80% 0px 意味着只要元素在视口顶部 20% 的区域内就会触发
        rootMargin: "0px 0px -80% 0px",
        threshold: [0], // 只要有一个像素进入就触发
      }
    );

    // 观察所有的摘要锚点
    summaries.forEach((s) => {
      const el = document.getElementById(s.start_sId);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [summaries, setActiveSentenceId, content, isManualScrolling]);
}
