/**
 * 阅读器正文区域组件
 */
export function Content() {
  return (
    <section className="flex-1 overflow-y-auto bg-base-200/30 p-8 md:p-12 scroll-smooth">
      <article className="max-w-2xl mx-auto prose prose-neutral lg:prose-lg text-justify">
        <h2>1.1 起源</h2>

        <p>
          在遥远的银河边缘，有一颗名为“叶子”的星球。这里的树木是发光的，每一片叶子都蕴含着远古的智慧。
        </p>

        <p>年轻人凯尔站在山巅，凝视着脚下的森林。他知道，今天将是他人生中最重要的一天。</p>

        <p>风轻轻吹过，带走了林间的低语。那是先辈们的呼唤，也是对未来的期许。</p>

        <p>他握紧了手中的法杖，深吸一口气。这种宁静即将被打破，而他必须为此做好准备。</p>

        <p>远方的天空微微泛红，正如他此刻的心情，充满了对未知的探索欲。</p>

        {/* 更多占位内容 */}
        {Array.from({ length: 15 }).map((_, i) => (
          <p key={i}>
            占位文本：这是本章节的其余段落内容，通过 prose 自动管理行间距和外边距，以保证完美的阅读体验。
          </p>
        ))}
      </article>
    </section>
  );
}
