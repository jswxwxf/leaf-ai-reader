"use client";

import { useReaderStore } from "../_store/store";
import { useScrollspy } from "../_hooks/use-scrollspy";

interface Props {}

/**
 * 阅读器正文区域组件
 */
export function Content({}: Props) {
  const content = useReaderStore((state) => state.content);
  
  // 激活滚动监听
  useScrollspy();

  return (
    <section className="flex-1 overflow-y-auto bg-base-200/30 px-4 md:px-0 scroll-smooth relative scroll-pt-20">
      {content ? (
        <article
          className="max-w-2xl mx-auto prose prose-neutral lg:prose-lg text-justify py-10 pb-[60vh]"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div className="max-w-2xl mx-auto py-20 text-center opacity-50">
          暂无内容或正在加载...
        </div>
      )}
    </section>
  );
}
