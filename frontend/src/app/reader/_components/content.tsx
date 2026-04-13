"use client";

import { use } from "react";
import { useReaderStore, ReaderStoreContext } from "../_store/store";
import { useScrollspy } from "../_hooks/use-scrollspy";
import { Scroller } from "./scroller";
import styles from "./content.module.css";
import { stopSpeech } from "../_hooks/use-speech";

interface Props { }

/**
 * 阅读器正文区域组件
 */
export function Content({ }: Props) {
  // 只订阅 content，点击时的 speechSentenceId 通过 store.getState() 一次性读取
  // 避免订阅 speechSentenceId 导致每次点击都触发重渲染，保护 useScrollspy 的 Observer 稳定
  const content = useReaderStore((state) => state.content);
  // 直接持有 store 实例（不订阅），用于事件处理器中一次性读取状态
  const store = use(ReaderStoreContext)!;

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
      const { speechSentenceId, setSpeechSentenceId } = store.getState();

      // 如果点击的是当前已经高亮的句子，直接返回，不做任何操作
      if (targetId === speechSentenceId) {
        return;
      }

      stopSpeech(store);
      setSpeechSentenceId(targetId);
    }
  };

  return (
    <section className={`flex-1 overflow-y-auto bg-base-200/30 px-4 md:px-0 scroll-smooth relative scroll-pt-20 ${styles.reader_content}`}>
      {/* 挂载独立的滚动协调器（无渲染） */}
      <Scroller />

      {content ? (
        <article
          className="max-w-2xl mx-auto prose prose-neutral lg:prose-lg text-justify py-10 pb-[60vh] cursor-pointer"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="text-base-content/40 animate-pulse">正在解析文章内容...</p>
        </div>
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
