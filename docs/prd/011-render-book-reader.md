# PRD 011: 图书 EPUB 实时提取与渲染 (Phase 2 & 3)

## 1. 目标

1. **图片提取**: 实现在阅读页面内展示 EPUB 内部图片的功能，包括实时提取、R2 缓存和地址重写。
2. **进度保存**: 实现图书阅读进度的持久化存储，支持用户在不同设备/会话间无缝续读。

## 2. 核心方案

### 2.1 图片处理 (Image Resource Proxy)

采用“极致懒加载”模式：Worker 仅重写路径，图片在滚动到视口时通过后端代理实时从 EPUB 提取并回填缓存。

1. **路径解析与重写**: 
   - 在 `processChapter` 时，通过 `resolvePath` 工具函数将 `<img>` 的相对路径转换为符合 EPUB 结构的绝对路径。
   - 重写 `src` 为代理地址：`/api/books/${bookId}/resource?path=${encodeURIComponent(absPath)}`。
   - 自动注入 `loading="lazy"` 以利用浏览器原生的延迟加载能力。
2. **镜像存储 (R2)**: 
   - 资源存储路径完全镜像 EPUB 内部物理结构：`books/${userId}/${bookId}/content/${path}`。
   - 这种 1:1 映射确保了 R2 作为书籍解压后的逻辑投影。
3. **前端资源代理 (Real-time Proxy)**:
   - 访问接口时优先检索 R2。若缺失（Cache Miss），则通过 RPC 调用 Worker 的 `processResource` 方法。
   - **异步回填**：数据返回给用户时，通过 `ctx.waitUntil` 在后台异步写入 R2，不阻塞用户感知到的首屏加载速度。

### 2.2 阅读进度 (Reading Progress)

1. **数据模型**: 在 D1 中建立 `reading_progress` 表或在 `books` 表中维护进度字段。
2. **服务端同步**: 接口支持获取与更新用户的阅读路径（Chapter Path）及具体句子 ID。
3. **前端策略**: 采用“Helper 驻留式”更新。监听章节切换，非阻塞式向后端同步进度。

## 3. 技术规范

- **按需加载**: 利用 `loading="lazy"` 减少首屏网络压力和不必要的服务器计算开销。
- **UI 占位符 (Skeleton)**: 为防止布局抖动 (CLS)，图片加载期间显示带有 `min-height` 的静态灰色背景块，且背景色自动适配系统深/浅色模式。
- **命名规范**: 所有资源提取处理逻辑统一以 `processResource` 命名，保持与 `processChapter` 的一致性。
- **兼容性平衡**: `cleanHtml` 引擎在处理文章爬虫（无 bookId 场景）时需保持向下兼容，不执行路径重写逻辑。
- **安全与性能**: 资源代理需校验权限，并携带强缓存头 `Cache-Control: public, max-age=31536000, immutable`。

## 4. 任务清单

- [x] **基础设施**: R2 Bucket 与 D1 配置支持实时资源存取。
- [x] **图片提取逻辑**:
    - [x] `book-worker` 实现基于 `resolvePath` 的 URL 重写机制。
    - [x] `book-worker` 实现 `processResource` RPC 提取接口。
    - [x] `frontend` 实现基于 R2 缓存优先且带后台回写的资源代理接口。
    - [x] `frontend` 注入静态图片占位符 CSS (Skeleton UI)。
- [x] **阅读进度持久化**:
    - [x] D1 数据库迁移：在 `books` 表中增加对应的进度记录逻辑。
    - [x] `frontend` 调用 Server Action / API 更新进度。

## 5. 进度

- **状态**: 已完成 (Completed)
- **最近更新**: 2026-04-17 (全链路功能验收通过)
- **依赖**: 
  - PRD-008 (视觉规范), PRD-012 (章节翻页)
