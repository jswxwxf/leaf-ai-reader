# PRD 011: 图书 EPUB 实时提取与渲染 (Phase 2 & 3)

## 1. 目标

1. **图片提取**: 实现在阅读页面内展示 EPUB 内部图片的功能，包括实时提取、R2 缓存和地址重写。
2. **进度保存**: 实现图书阅读进度的持久化存储，支持用户在不同设备/会话间无缝续读。

## 2. 核心方案

### 2.1 图片处理 (Image Extraction & Proxy)

基于“按需实时提取”模式，在 Worker 处理章节 HTML 时同步处理图片：

1. **扫描与提取**: 在 `processChapter` 过程中，解析 HTML 中的 `<img>` 标签。
2. **R2 存储**: 
   - 将图片文件从 EPUB 提取并存入 R2，路径规则：`books/${userId}/${bookId}/images/${relPath}`。
   - 使用图片的原始 MIME 类型进行存储。
3. **URL 重写**: 将 HTML 中的 `src` 替换为前端代理地址：`/api/books/${bookId}/images/${relPath}`。
4. **前端代理 (Proxy)**: 前端实现路由拦截 `/api/books/[bookId]/images/[...path]`，从 R2 读取内容并返回（带缓存头）。

### 2.2 阅读进度 (Reading Progress)

1. **数据模型**: 在 D1 中建立 `reading_progress` 表。
   - `id`, `user_id`, `book_id`, `current_path`, `current_sentence_id`, `updated_at`。
2. **服务端同步**:
   - `GET /api/books/[bookId]/progress`: 获取最后一次阅读状态。
   - `POST /api/books/[bookId]/progress`: 更新当前阅读状态。
3. **前端策略**:
   - **初始化**: 进入阅读器时，若 URL 无 `path` 参数，则自动从后端同步进度并重定向。
   - **自动保存**: 监听章节切换事件，或定期（如每 30 秒）持久化当前状态。

## 3. 技术规范

- **图片安全**: 代理接口需校验 `user_id` 和 `book_id` 权限，防止横向越权访问。
- **性能**: 图片资源在 R2 存储时需带有强缓存头 (`Cache-Control`)。
- **一致性**: 阅读进度更新应采用 `UPSERT` 逻辑。

## 4. 任务清单

- [x] **实时解压 API**: `book-worker` 已支持。
- [x] **通用清洗引擎**: 已支持 DOM 平坦化与句子分割。
- [ ] **图片提取逻辑**:
    - [ ] `book-worker` 增加图片扫描与 R2 写入。
    - [ ] `book-worker` 增加 HTML `img src` 重写逻辑。
    - [ ] `frontend` 实现图片预览代理接口。
- [x] **阅读进度持久化**:
    - [x] D1 数据库迁移：在 `books` 表中增加 `bookmark` 和 `progress` 字段。
    - [x] `frontend` 实现进度同步 Server Action (`updateBookProgress`)。
    - [x] `frontend` Reader 界面集成进度加载与自动同步逻辑 (`Helper.tsx`)。

## 5. 进度

- **状态**: 进行中 (In Progress)
- **最近更新**: 2026-04-17 (新增图片提取与进度保存计划)
- **依赖**: 
  - PRD-003, PRD-006, PRD-012 (章节翻页)
