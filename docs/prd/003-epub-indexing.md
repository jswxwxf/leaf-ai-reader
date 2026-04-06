# PRD-003: EPUB 结构解析与全量资源提取

## 1. 目标

图书上传到 R2 后，立即将 EPUB 完整解压，提取所有资源（章节 HTML、图片、CSS、元数据），全部存入 R2 和 D1，为阅读功能做好准备。

## 2. 方案

### 全量提取（上传时一次性完成）

将 EPUB 完整解压，所有文件统一写入 R2。不做懒加载，不操作 ZIP 字节偏移。

好处：
- 实现简单，无边缘情况（避免 ZIP64、加密 EPUB 等兼容性问题）
- 章节读取时直接从 R2 取文件，无额外处理
- 免费额度完全够用（见额度分析）

### 解压流程

```
上传完成后触发解压
  -> 用 fflate 在 Worker 内存中解压整个 EPUB
  -> 解析 META-INF/container.xml → 找到 content.opf
  -> 解析 content.opf → 提取书名、作者、spine 章节顺序
  -> 解析 toc.ncx / nav.xhtml → 提取章节标题
  -> 将所有文件并行写入 R2（章节 HTML、图片、CSS、封面）
  -> 对每个章节 HTML 做路径替换（相对路径 → R2 URL）
  -> 批量写入 D1（books 表 + chapters 表）
  -> 删除 / 保留原始 EPUB（可选）
```

### R2 存储路径规范

```
r2://leaf-books/
└── books/{userId}/{bookId}/
    ├── cover.jpg
    ├── assets/
    │   ├── images/figure1.jpg
    │   └── styles/main.css
    └── chapters/
        ├── ch00.html
        ├── ch01.html
        └── ...
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
  book_id TEXT NOT NULL REFERENCES books(id),
  chapter_order INTEGER NOT NULL,
  title TEXT,
  r2_key TEXT NOT NULL,   -- 章节 HTML 在 R2 中的路径
  UNIQUE(book_id, chapter_order)
);
```

注：不再需要 `zip_offset`、`zip_compressed_size`、`epub_internal_path`、`book_assets` 表，大幅简化数据模型。

## 4. 任务清单

- [ ] **D1 数据表迁移脚本**: 编写建表 SQL
- [ ] **EPUB 解压库选型**: 引入 `fflate`，验证在 Cloudflare Workers 中可用
- [ ] **EPUB 解析器**: 实现 container.xml / content.opf / TOC 解析
- [ ] **全量资源写入 R2**: 并行 `PUT` 所有文件到 R2
- [ ] **章节 HTML 路径替换**: img src / link href 替换为 R2 URL
- [ ] **D1 写入**: 写入 books 和 chapters 记录
- [ ] **接入 PRD-002 的触发点**: 在 `uploadBook` Server Action 完成后调用解析逻辑

## 5. 进度

- **状态**: 待开始 (Pending)
- **依赖**: PRD-002（上传图书）
