# PRD-004: 阅读页面

## 1. 目标

实现章节阅读页面。用户点击书架上的图书后，进入阅读界面，直接从 R2 读取已处理好的章节 HTML 渲染展示。

## 2. 方案

PRD-003 已完成全量解压，章节 HTML 已存入 R2，图片路径已替换为 R2 URL。本 PRD 只需：

1. 从 D1 查询章节的 `r2_key`
2. 从 R2 读取对应 HTML 文件
3. 渲染到页面

无需处理 ZIP，无需懒加载，无并发安全问题。

## 3. 阅读页面路由

```
/reader/[bookId]/[chapterIndex]
```

使用 Next.js Server Component 直接渲染，无需额外 API 层：

```typescript
// app/reader/[bookId]/[chapterIndex]/page.tsx
export default async function ReaderPage({ params }) {
  const chapter = await getChapter(params.bookId, params.chapterIndex);
  const html = await getChapterHtml(chapter.r2_key); // 从 R2 读取
  return <ReaderView html={html} />;
}
```

### 页面结构

```
/reader/[bookId]/[chapterIndex]
├── 顶部导航栏（书名 + 上一章 / 下一章 按钮）
├── 章节内容区（渲染 HTML，应用自定义阅读样式）
└── 底部进度条（当前章节 / 总章节数）
```

## 4. 安全性

EPUB HTML 内容需过滤后渲染，防止 XSS：
- 使用白名单标签方式清理（`DOMPurify` 或服务端等价实现）
- 允许标签：常见排版标签（`p`、`h1-h6`、`img`、`em`、`strong` 等）
- 图片 src 仅允许指向 R2 域名

## 5. 任务清单

- [ ] **数据读取函数**: 实现 `getChapter(bookId, chapterIndex)` 从 D1 查询，`getChapterHtml(r2Key)` 从 R2 读取
- [ ] **阅读页面路由**: 创建 `/reader/[bookId]/[chapterIndex]/page.tsx`
- [ ] **HTML 安全渲染**: 实现内容清理 + 渲染组件
- [ ] **阅读页面 UI**: 导航栏、内容区（自适应字体/行高）、章节导航按钮
- [ ] **Dashboard 联动**: 图书卡片点击后跳转到 `/reader/[bookId]/0`

## 6. 进度

- **状态**: 待开始 (Pending)
- **依赖**: PRD-003（EPUB 解析与资源提取）
