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
  const { speechSentenceId, isManualScrolling, summaries, setSummarySentenceId } = useReaderStore(
    useShallow((state) => ({
      speechSentenceId: state.speechSentenceId,
      isManualScrolling: state.isManualScrolling,
      summaries: state.summaries,
      setSummarySentenceId: state.setSummarySentenceId,
    }))
  );

  useEffect(() => {
    if (!speechSentenceId) return;

    const el = document.getElementById(speechSentenceId);
    if (!el) return;

    // 当语音朗读跳转或跟进到了属于摘要的句子时，自动触发侧边栏高亮
    if (summaries.some((s) => s.start_sId === speechSentenceId)) {
      setSummarySentenceId(speechSentenceId);
    }

    // 仅在滚动锁解除后（或非手动滚动期间）才执行视口同步
    // 手动跳转期间 Scroller 只负责高亮，滚动由 jumpToSentence 自己触发
    if (!isManualScrolling) {
      scrollIntoViewIfNeeded(el);
    }

    // 无论如何都要确保高亮存在（补偿重渲染导致的类名丢失）
    document.querySelectorAll('.active-sentence').forEach(node => {
      node.classList.remove('active-sentence');
    });
    el.classList.add('active-sentence');

  }, [speechSentenceId, isManualScrolling]);

  return null;
}
