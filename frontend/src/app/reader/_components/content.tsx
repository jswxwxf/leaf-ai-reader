"use client";

import { useReaderStore } from "../_store/store";
import { useScrollspy } from "../_hooks/use-scrollspy";
import { Scroller } from "./scroller";
import styles from "./content.module.css";

interface Props {}

/**
 * 阅读器正文区域组件
 */
export function Content({}: Props) {
  const content = useReaderStore((state) => state.content);
  
  // 激活滚动监听
  useScrollspy();

  return (
    <section className={`flex-1 overflow-y-auto bg-base-200/30 px-4 md:px-0 scroll-smooth relative scroll-pt-20 ${styles.reader_content}`}>
      {/* 挂载独立的滚动协调器（无渲染） */}
      <Scroller />
      
      {content ? (
        <article
          className="max-w-2xl mx-auto prose prose-neutral lg:prose-lg text-justify py-10 pb-[60vh]"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="text-base-content/40 animate-pulse">正在解析文章内容...</p>
        </div>
      )}
      
      {/* 绕过 CSS 解析器对 ::highlight 的解析限制，通过原生 style 标签注入 */}
      <style dangerouslySetInnerHTML={{ __html: `
        ::highlight(word-focus) {
          background-color: oklch(0.56 0.21 253 / 0.2);
          color: inherit;
        }
      `}} />
    </section>
  );
}
