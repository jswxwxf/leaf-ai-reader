"use client";

import { useEffect } from "react";
import { useReaderStore, useReaderStoreRaw } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { useScrollspy } from "../_hooks/use-scrollspy";
import { Scroller } from "./scroller";
import styles from "./content.module.css";
import { stopSpeech } from "../_hooks/use-speech";

interface Props { }

/**
 * 阅读器正文区域组件
 */
export function Content({ }: Props) {
  // 使用 useShallow 合并订阅，减少重渲染次数
  const { content, isContentLoading, setSpeechSentenceId, setIsPlaying } = useReaderStore(
    useShallow((state) => ({
      content: state.content,
      isContentLoading: state.isContentLoading,
      setSpeechSentenceId: state.setSpeechSentenceId,
      setIsPlaying: state.setIsPlaying,
    }))
  );
  // 直接持有 store 实例（不订阅），用于事件处理器中一次性读取状态
  const rawStore = useReaderStoreRaw();

  /**
   * 核心重置逻辑：当章节内容发生物理变更时（包括切章节时的清空），
   * 必须强制重置语音状态，防止残留的句子 ID 干扰新章节的朗读定位。
   */
  useEffect(() => {
    // 1. 物理中断语音引擎
    window.speechSynthesis?.cancel();
    // 2. 逻辑重置进度和状态
    setSpeechSentenceId(null);
    setIsPlaying(false);
    // 3. 视觉清理高亮
    if (typeof CSS !== 'undefined' && (CSS as any).highlights) {
      (CSS as any).highlights.get("word-focus")?.clear();
    }
  }, [content, setSpeechSentenceId, setIsPlaying]);

  // 激活滚动监听
  useScrollspy();

  /**
   * 处理正文区域的点击事件 (采用事件委托)
   */
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 寻找最近的句子元素 (以 s- 开头的 ID)
    const sentenceEl = target.closest('[id^="s-"]');

    if (sentenceEl && sentenceEl.id) {
      const targetId = sentenceEl.id;

      // 在事件处理器里一次性读取当前值，不需要响应式订阅
      const { speechSentenceId, setSpeechSentenceId } = rawStore.getState();

      // 如果点击的是当前已经高亮的句子，直接返回，不做任何操作
      if (targetId === speechSentenceId) {
        return;
      }

      stopSpeech(rawStore);
      setSpeechSentenceId(targetId);
    }
  };

  return (
    <section className={`flex-1 overflow-y-auto bg-base-200/50 px-4 md:px-8 scroll-smooth relative scroll-pt-20 custom-scrollbar ${styles.reader_content}`}>
      {/* 挂载独立的滚动协调器（无渲染） */}
      <Scroller />

      {isContentLoading || !content ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="text-base-content/40 animate-pulse">正在解析内容...</p>
        </div>
      ) : (
        <article
          className="max-w-2xl lg:max-w-3xl mx-auto prose prose-neutral lg:prose-lg py-10 pb-[60vh] cursor-pointer"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}

      {/* 绕过 CSS 解析器对 ::highlight 的解析限制，通过原生 style 标签注入 */}
      <style dangerouslySetInnerHTML={{
        __html: `
        ::highlight(word-focus) {
          background-color: oklch(0.56 0.21 253 / 0.2);
          color: inherit;
        }
      `}} />
    </section>
  );
}
