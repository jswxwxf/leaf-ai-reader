# PRD 011: 图书 EPUB 实时提取与渲染 (Phase 2 & 3)

## 1. 目标

1. **图片提取**: 实现在阅读页面内展示 EPUB 内部图片的功能，包括实时提取、R2 缓存和地址重写。
2. **进度保存**: 实现图书阅读进度的持久化存储，支持用户在不同设备/会话间无缝续读。

## 2. 核心方案

### 2.1 图片处理 (Image Resource Proxy)

采用“极致懒加载”模式：Worker 仅重写路径，图片在滚动到视口时通过后端代理实时从 EPUB 提取并回填缓存。

1. **路径解析与重写**: 
   - 在 `processChapter` 时，解析 `<img>` 的相对路径为相对于书籍根目录的绝对路径 (`internalPath`)。
   - 重写 `src` 为：`/api/books/${bookId}/resource?path=${encodeURIComponent(internalPath)}`。
   - 为所有 `<img>` 标签注入 `loading="lazy"` 属性。
2. **镜像存储 (R2)**: 
   - 资源存储路径完全镜像 EPUB 内部结构：`books/${userId}/${bookId}/content/${internalPath}`。
   - 这样 R2 的 `content/` 目录即为书籍解压后的完整投影。
3. **前端资源代理 (Real-time Proxy)**:
   - 访问代理接口时，优先检查 R2 缓存。
   - 若缓存未命中（Cache Miss），通过 RPC 调用 Worker 的 `extractResource` 接口。
   - Worker 从原始 EPUB 中提取二进制流返回，代理接口将其返回给前端并异步写回 R2。

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

- **按需加载**: 利用 `loading="lazy"` 减少首屏网络压力和不必要的 Worker 计算。
- **镜像结构**: R2 路径必须与 `internalPath` 严格一致，便于管理和维护。
- **图片安全**: 代理接口需校验用户的书籍访问权限。
- **性能**: 图片资源在响应时需带上 `Cache-Control: public, max-age=31536000, immutable`。

## 4. 任务清单

- [x] **实时解压 API**: `book-worker` 已支持。
- [x] **通用清洗引擎**: 已支持 DOM 平坦化与句子分割。
- [x] **图片提取逻辑**:
    - [x] `book-worker` 实现路径解析与 URL 重写逻辑（注入 `lazy` 加载）。
    - [x] `book-worker` 新增 `extractResource` RPC 提取接口。
    - [x] `frontend` 实现基于 R2 缓存优先的资源代理接口。
- [x] **阅读进度持久化**:
    - [x] D1 数据库迁移：在 `books` 表中增加 `bookmark` 和 `progress` 字段。
    - [x] `frontend` 实现进度同步 Server Action (`updateBookProgress`)。
    - [x] `frontend` Reader 界面集成进度加载与自动同步逻辑 (`Helper.tsx`)。

## 5. 进度

- **状态**: 进行中 (In Progress)
- **最近更新**: 2026-04-17 (新增图片提取与进度保存计划)
- **依赖**: 
  - PRD-003, PRD-006, PRD-012 (章节翻页)
