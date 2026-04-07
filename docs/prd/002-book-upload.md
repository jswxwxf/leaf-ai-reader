# PRD-002: 上传图书（MVP - 异步增强版）

## 1. 目标

提供一个极速响应、实时进度感知的图书上传体验。用户上传后无需长时间阻塞等待，可即刻回到 Dashboard 观察解析进展。

## 2. 方案：异步解耦与进度追踪

利用 Route Handler 的灵活性，实现“秒传+异步处理”的体验。

### 核心链路
1.  **上传接口 (POST `/api/books/upload`)**
    *   **鉴权 & 并发控制**: 检查用户身份。
    *   **I/O 操作**: 流式写入 R2 存储桶。
    *   **写占位符**: 在 D1 中创建书籍记录（STATUS: 'processing', PROGRESS: 0）。
    *   **立刻返回**: 返回 `bookId` 和 `202 Accepted`。
    *   **后台触发**: 响应返回后，利用 `event.waitUntil()` 或 Service Binding 无阻塞地触发 `book-worker`。

2.  **解析逻辑 (book-worker)**
    *   分步骤解析书籍。
    *   **更新状态**: 每完成一个关键点（如封面提取、元数据写入），立即更新 D1 中的 `PROGRESS` 值。
    *   **最终归档**: 完成后将状态改为 `ready`。

3.  **查询接口 (GET `/api/books/[id]/status`)**
    *   前端根据 `bookId` 自动开启轮询。
    *   返回数值型的 `progress` (0-100) 和 `status` 描述。

### 为何改回 Route Handler?
1.  **非阻塞请求**: Server Action 往往需要等函数执行完才返回。Route Handler 可以通过特定的流响应或在返回结果后执行后台任务，体验更顺畅。
2.  **API 语义化**: 上传就是 POST，查询就是 GET，符合标准的 RESTful 规范，方便以后扩展（如集成移动端）。

## 3. 基础设施前置条件

- [ ] **R2/D1 Binding**: 同前（绑定在 `frontend/wrangler.jsonc`）。
- [ ] **Service Binding**: 关键！必须通过 Service Binding 异步触发解析逻辑。
- [ ] **D1 架构设计**: 在书籍表中增加 `status` (string) 和 `progress` (integer) 字段。

## 4. 任务清单

- [ ] **D1 Schema 更新**: 运行 SQL 增加书籍状态与进度追踪字段。
- [ ] **配置更新**: 在 `frontend/wrangler.jsonc` 实现全 Binding。
- [ ] **Upload API**: 开发 `src/app/api/books/upload/route.ts`。
- [ ] **Status API**: 开发 `src/app/api/books/[id]/status/route.ts`。
- [ ] **book-worker**: 核心解析逻辑与 D1 进度反馈。
- [ ] **前端体验**: 
    - 实现上传 Modal。
    - 展示进度条 (Progress Bar) 或状态标记 (Processing Tag)。
    - 实现轮询机制 (Polling) 或使用 SWR 等钩子自动同步状态。

## 5. 进度

- **状态**: 待开始 (Pending)
- **架构确认**: **Route Handler (异步上传) + 后台解析 + 进度轮询**。这是当前云原生环境下用户体验最优的空间方案。
