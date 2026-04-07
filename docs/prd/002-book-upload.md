# PRD 002: 图书上传架构实现 (最终版)

## 1. 概述
本方案为 Leaf AI Reader 提供高性能、低延迟的图书上传功能。采用 **Cloudflare-Native** 架构，利用 `ctx.waitUntil` 实现背景上传，使用 **Route Handler** 绕过限制。

## 2. 核心链路设计

### 2.1 鉴权层 (Middleware)
*   **统一拦截**: `src/middleware.ts` 监听包括 `/api/*` 在内的所有路径。
*   **令牌校验**: 验证 `Logto-ID-Token` 签名。
*   **本地开发**: 为 Mock 用户 `local-dev` 提供直通通道。

### 2.2 上传接口 (Route Handler: `/api/books/upload`)
*   **路由**: `POST /api/books/upload`
*   **逻辑流程**:
    1.  **解析表单**: 获取 `FormData` 中的 EPUB 文件。
    2.  **D1 占位 (同步)**:
        *   创建书籍记录，ID 为 UUID。
        *   状态设置: `STATUS: 'uploading'`。
        *   完成后**立即返回**给前端。
    3.  **R2 存储 (背景异步)**:
        *   使用 `ctx.waitUntil()` 启动异步任务。
        *   将文件写入 R2 路径: `books/${userId}/${bookId}/original.epub`。
        *   若上传成功，更新 D1 状态为 `'processing'`。
        *   若上传失败，更新 D1 状态为 `'error'`。

### 2.3 前端请求层 (request.ts)
*   **透明代理**: 封装原生 `fetch`。
*   **全局拦截**: 自动解析 JSON 响应并处理 HTTP 非 OK 状态。
*   **统一提醒**: 失败时触发全局 `alert` 提示。
*   **抛错机制**: 失败时 `throw error`，配合组件 `finally` 清理加载状态。

## 3. 技术规范

### 3.1 数据库结构 (D1)
*   **表名**: `books`
*   **字段**: `id` (PK), `user_id`, `title`, `status` (`'uploading' | 'processing' | 'ready' | 'error'`)。

### 3.2 存储路径 (R2)
*   **分片规则**: `books/{userId}/{bookId}/original.epub`。

### 3.3 性能限制
*   **最大文件**: 50MB (前端配置 & Cloudflare 默认为 100MB)。
*   **超时**: 边缘环境下通过 `ctx.waitUntil` 绕过 HTTP 响应超时限制。

## 4. 开发状态
- [x] 配置 R2 & D1 绑定。
- [x] 实现中间件 API 鉴权。
- [x] 实现 Route Handler 异步上传。
- [x] 封装全平台通用 `request` 工具。
- [x] 打通 UI 上传组件及其状态控制。
