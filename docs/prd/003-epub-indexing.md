# PRD-003: EPUB 结构解析与全量资源提取

## 1. 目标

图书上传到 R2 后，通过 `book-worker` 进行轻量化解析：提取元数据、封面图并将全书内容分块进入 **Vectorize 向量数据库** 实现语义索引。书籍的具体章节 HTML 采用“按需实时解压”模式，以适配 Cloudflare Free Tier 的 CPU 限制并支持智能 AI 问答。

## 2. 方案

### 轻量化解析与语义索引

不再将解压后的数百个小文件全量写入 R2，而是保留原始 EPUB，实时提取。同时通过 Vectorize 实现全书语义检索。

**为什么调整？**
- **规避 CPU 超时**：Free Tier 只有 10ms CPU 时间，全量解压并循环 `PUT` 到 R2 极易超时。
- **语义化 (Semantic)**：通过 Vectorize 索引文本块，AI 能实现基于上下文的精准查找（RAG），不再依赖笨重的全量文本下载。
- **无限扩展**：未来通过对 Vectorize 的查询，可以实现全书搜索、主题归纳和个性化 AI 问答。
- **性能平衡**：章节 HTML 分离解压，单次读取开销极低。

### 处理流程 (book-worker)

```
上传完成后通过 RPC 触发 processBook
  -> 从 R2 读取原始 EPUB (ArrayBuffer)
  -> 用 JSZip 在 Worker 内存中加载索引（Central Directory）
  -> 解析 META-INF/container.xml → 找到 content.opf
  -> 提取元数据：书名、作者、书架顺序
  -> 提取封面图 (Cover) -> 存入 R2 特定路径
  -> 文本分块 (Chunking)：(TODO/未来扩展) 遍历各章节内容进行按块切分
  -> 向量化 (Embedding)：(TODO/未来扩展) 调用 Workers AI 接口生成向量
  -> 批量存入 Vectorize：(TODO/未来扩展) 实现全书语义索引
  -> 将章节标题与内部路径 (Internal Path) 存入 D1 chapters 表
  -> 更新 books 表状态为 'ready'
```

### 阅读时的请求流程 (getChapter/getResource)

1. **获取章节内容 (getChapter)**
   - 前端请求特定章节 (bookId, chapterId)
   - Worker 从 R2 读取原始 EPUB 并定位到 HTML
   - **内容清洗 (Streaming Cleanse)**：使用 Cloudflare `HTMLRewriter` 进行流式处理：
     - **标签解包 (Unwrap)**：移除 `<span>`、`<font>` 等内联标签的外壳，仅保留内部文字，从而合并 `<span>你</span><span>好</span>` 这种碎片化内容
     - **冗余剔除**：移除所有的 `<link>`、`<style>`、`<script>` 标签
     - **样式清理**：移除标签上的 `class`、`id` (可选) 和内联 `style` 属性
     - **资源映射**：重写 `<img>` 标签的 `src`，转换为预览代理地址
   - 返回清洗后的“纯净版”HTML 片段
   - 前端挂载统一的“阅读模式”CSS 样式表

2. **获取具体资源 (getResource/Asset Strategy)**
   - 前端根据 HTML 里的链接请求资源 (img, css, fonts)
   - Worker 优先尝试从 R2 缓存目录 `assets/` 读取
   - 若不存在缓存：
     - 从 R2 读取 `original.epub`
     - 使用 JSZip 解压特定资源文件
     - 将解压后的文件流式写入 R2 缓存目录（`ctx.waitUntil` 异步完成）
     - 返回给前端

### R2 存储路径规范

```
r2://leaf-books/
└── books/{userId}/{bookId}/
    ├── original.epub      # 原始上传文件（源头）
    ├── cover.jpg          # 提取的封面（列表显示用）
    └── assets/            # 【按需提取缓存】存储解压后的图片、CSS、字体等
        └── OEBPS/Images/   # 保持原 ZIP 内部目录结构
```

### 额度分析

典型 EPUB（1 封面 + 20 图片 + 2 CSS + 30 章）≈ 53 个文件 = 53 次 Class A 操作。
R2 免费额度 100 万次/月，上传 1 万本书才消耗 53 万次，完全可控。

## 3. D1 数据模型

```sql
-- 图书表
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  author TEXT,
  cover_r2_key TEXT,
  total_chapters INTEGER,
  status TEXT DEFAULT 'processing', -- processing | ready | error
  created_at INTEGER DEFAULT (unixepoch())
);

-- 章节表
CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_order INTEGER NOT NULL,
  title TEXT,
  internal_path TEXT NOT NULL,   -- 在原 EPUB (ZIP) 内部的相对路径
  UNIQUE(book_id, chapter_order)
);
```

## 4. 内容清洗与阅读模式标准化 (Content Normalization)

为确保不同来源的 EPUB 在阅读器中具有统一且纯净的视觉效果，Worker 在返回 HTML 前必须通过 `HTMLRewriter` 执行以下清洗逻辑：

### 4.1 标签处理规则 (Tag Strategy)

- **白名单 (Whitelist)**：保留具有强语义结构的标签：`h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `p`, `img`, `blockquote`, `ul`, `ol`, `li`, `br`。
- **解包 (Unwrap)**：对于纯表现性、无语义或易造成碎片化的标签，保留其内部文本/子元素，移除标签外壳：
  - **重点对象**：`span`, `font`, `div`, `section`, `article`。
  - **解决场景**：解决 `<span>你</span><span>好</span>` 转换为 `你好` 的问题。
- **黑名单 (Blacklist)**：直接移除标签及其内部所有内容：`link`, `style`, `script`, `iframe`, `object`, `embed`。

### 4.2 属性处理规则 (Attribute Strategy)

- **全面剔除**：移除所有标签上的 `class`, `id`, `style`, `width`, `height`, `align` 等视觉属性。
- **特定保留**：
  - `img`：仅保留 `src` 和 `alt`。`src` 需通过 `HTMLRewriter` 重写为 Worker 资源代理地址。
  - `ol`, `ul`：保留必要的 `type` 或 `start` 属性（如果存在）。

### 4.3 全局阅读态 CSS (Core CSS)

前端提供一套标准 CSS 变量支撑阅读模式，不再依赖图书原始 CSS：

```css
:root {
  --reader-font-family: "Inter", system-ui, sans-serif;
  --reader-font-size: 1.125rem;
  --reader-line-height: 1.75;
  --reader-paragraph-spacing: 1.5em;
  --reader-text-color: #1a1a1a;
  --reader-bg-color: #fcfcfc;
}

/* 统一排版规则 */
.reader-content p {
  margin-bottom: var(--reader-paragraph-spacing);
  line-height: var(--reader-line-height);
}
.reader-content img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
```

## 5. 任务清单

- [ ] **D1 数据表迁移脚本**: 编写建表 SQL (books + chapters)
- [ ] **EPUB 核心库引入**: 引入 `jszip` 和 `fast-xml-parser`
- [ ] **轻量化解析逻辑**: 实现元数据和封面图提取
- [ ] **语义索引构建 (TODO/未来扩展)**: 实现文本分块、Workers AI Embedding 与 Vectorize 存入逻辑
- [ ] **实时解压接口**: 实现 `getChapter(bookId, chapterId)` 方法
- [ ] **内容清洗引擎**: 利用 `HTMLRewriter` 实现流式 HTML 清洗与资源路径替换
- [ ] **资源代理接口**: 实现 `getResource(bookId, path)` 并支持 R2 缓存逻辑
- [ ] **D1 写入**: 批量写入章节索引记录数据到 D1

## 6. 进度

- **状态**: 待开始 (Pending)
- **依赖**: PRD-002（上传图书）
