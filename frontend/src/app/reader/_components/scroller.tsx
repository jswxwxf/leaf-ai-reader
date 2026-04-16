"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "../_store/store";
import { scrollIntoViewIfNeeded } from "../_utils/utils";

/**
 * 朗读与高亮调度器 (Scroller)
 * 职责：监听朗读 ID 变化，同步执行【滚动】和【正文高亮】
 * 同时监听 isManualScrolling：当手动跳转的滚动锁解除后，补偿一次高亮，
 * 防止 isManualScrolling 状态变化引起的组件重渲染把 DOM 类名洗掉
 */
export function Scroller() {
  const { speechSentenceId, isManualScrolling, summaries, setSummarySentenceId, content, contentRef } = useReaderStore(
    useShallow((state) => ({
      speechSentenceId: state.speechSentenceId,
      isManualScrolling: state.isManualScrolling,
      summaries: state.summaries,
      setSummarySentenceId: state.setSummarySentenceId,
      content: state.content,
      contentRef: state.contentRef,
    }))
  );

  useEffect(() => {
    if (!speechSentenceId || !contentRef?.current) return;

    const container = contentRef.current;

    // 定位元素（仅在当前阅读器容器内查找，防止多实例 ID 冲突）
    const el = container.querySelector(`[id="${speechSentenceId}"]`) as HTMLElement;
    if (!el) return;

    // 当语音朗读跳转或跟进到了属于摘要的句子时，自动触发侧边栏高亮
    if (summaries.some((s) => s.start_sId === speechSentenceId)) {
      setSummarySentenceId(speechSentenceId);
    }

    // 仅在滚动锁解除后（或非手动滚动期间）才执行视口同步
    if (!isManualScrolling) {
      scrollIntoViewIfNeeded(el);
    }

    // 补偿渲染引起的高亮丢失：
    // 当 content 变化导致页面重绘时，必须重新确保 active-sentence 类存在
    // 同样仅在当前容器内进行清理和添加，不干扰外部
    container.querySelectorAll('.active-sentence').forEach(node => {
      node.classList.remove('active-sentence');
    });
    el.classList.add('active-sentence');

  }, [speechSentenceId, isManualScrolling, content, contentRef]);

  return null;
}
