# PRD-003: EPUB 结构解析与全量资源提取

## 1. 目标

图书上传到 R2 后，通过 `book-worker` 进行轻量化解析：提取元数据、封面图、生成章节目录文件 (`toc.json`)。书籍的具体章节 HTML 采用“按需实时解压”模式，以适配 Cloudflare Free Tier 的 CPU 限制并支持后续的语义索引与 AI 问答。

## 2. 方案

### 轻量化解析与目录存储

不再将章节索引存入 D1 数据库，以减少数据库写操作和复杂的关联查询。解析后的目录结构（TOC）将以 `toc.json` 文件形式存储在 R2 中书籍所属目录下。

**主要变动：**
- **去数据库化**：移除 `chapters` 表。
- **静态化目录**：将 TOC 序列化为 JSON，前端直接读取或通过 API 获取。
- **性能优化**：减少 D1 的数据占用，解析过程更直接，避免 D1 的写入限制。

### 处理流程 (book-worker)

```
上传完成后通过 RPC 触发 processBook
  -> 从 R2 读取原始 EPUB (ArrayBuffer)
  -> 用 JSZip 在 Worker 内存中加载索引（Central Directory）
  -> 解析 META-INF/container.xml → 找到 content.opf
  -> 提取元数据：书名、作者、发布日期
  -> 提取封面图 (Cover) -> 存入 R2 特定路径
  -> 递归解析 TOC (NCX/Nav)：提取章节标题、层级关系与内部路径 (Internal Path)
  -> 生成 toc.json -> 存入 R2 书籍目录下
  -> 更新 books 表状态为 'ready'
```

### 阅读时的请求流程 (getChapter/getResource)

1. **获取目录 (getTOC)**
   - 前端通过书 ID 请求目录。
   - Worker 从 R2 读取该书目录下的 `toc.json` 并返回。

2. **获取章节内容 (getChapter)**
   - 前端根据 `toc.json` 中的 `internal_path` 或章节标识请求特定内容。
   - Worker 从 R2 读取原始 EPUB 并定位到对应的 HTML 文件。
   - **内容清洗 (Streaming Cleanse)**：使用 Cloudflare `HTMLRewriter` 进行流式处理：
     - **标签解包 (Unwrap)**：移除 `<span>`、`<font>` 等内联标签的外壳，解决碎片化内容问题。
     - **冗余剔除**：移除所有的 `<link>`、`<style>`、`<script>` 标签。
     - **样式清理**：移除标签上的 `class`、`id` 和内联 `style` 属性。
     - **资源映射**：重写 `<img>` 标签的 `src`，转换为预览代理地址。
   - 返回清洗后的“纯净版”HTML 片段。

3. **获取具体资源 (getResource/Asset Strategy)**
   - 前端根据 HTML 里的链接请求资源 (img, css, fonts)。
   - Worker 优先尝试从 R2 缓存目录 `assets/` 读取。
   - 若不存在缓存：从 R2 读取 `original.epub` 并解压特定资源文件，流式回传并异步写入 R2 缓存。

### R2 存储路径规范

```
r2://leaf-books/
└── books/{userId}/{bookId}/
    ├── original.epub      # 原始上传文件（源头）
    ├── cover.jpg          # 提取的封面（列表显示用）
    ├── toc.json           # 章节目录结构 (JSON)
    └── assets/            # 【按需提取缓存】存储解压后的图片、CSS、字体等
        └── OEBPS/Images/   # 保持原 ZIP 内部目录结构
```

### toc.json 结构说明

```json
[
  {
    "title": "第一章：起航",
    "path": "OEBPS/Text/ch01.xhtml",
    "children": [
      {
        "title": "1.1 背景介绍",
        "path": "OEBPS/Text/ch01_1.xhtml"
      }
    ]
  },
  {
    "title": "第二章：基础",
    "path": "OEBPS/Text/ch02.xhtml"
  }
]
```

## 3. D1 数据模型

```sql
-- 图书表
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  author TEXT,
  published_at TEXT,
  cover_r2_key TEXT,
  status TEXT DEFAULT 'processing', -- processing | ready | error
  created_at INTEGER DEFAULT (unixepoch())
);

-- 注意：移除 chapters 表，改用 R2 存储 toc.json
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

- [ ] **EPUB 核心库引入**: 引入 `jszip` 和 `fast-xml-parser`
- [ ] **轻量化解析逻辑**: 实现元数据和封面图提取
- [ ] **TOC 解析与生成**: 递归解析目录并生成 `toc.json`
- [ ] **R2 写入服务**: 实现 `toc.json` 和封面图的上传统一接口
- [ ] **实时解压接口**: 实现 `getChapter(bookId, path)` 方法
- [ ] **内容清洗引擎**: 利用 `HTMLRewriter` 实现流式 HTML 清洗与资源路径替换
- [ ] **资源代理接口**: 实现 `getResource(bookId, path)` 并支持 R2 缓存逻辑
- [ ] **D1 更新**: 更新 book 状态及元数据

## 6. 进度

- **状态**: 正在进行 (In Progress)
- **依赖**: PRD-002（上传图书）
