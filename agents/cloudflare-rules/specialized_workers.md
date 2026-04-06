---
description: Cloudflare 特色功能与集成规则（WebSocket, Durable Objects, Agents, Workflows）
---

# Cloudflare 特色功能与集成

## Cloudflare 服务集成

当需要数据存储时，集成适当的 Cloudflare 服务：

- **Workers KV**：用于键值存储，包括配置数据、用户个人资料和 A/B 测试。
- **Durable Objects**：用于强一致性状态管理、存储、多玩家协作和 Agent 场景。
- **D1**：用于关系型数据及其 SQL 方言。
- **R2**：用于对象存储，包括存储结构化数据、AI 资产、图像资产和面向用户的上传。
- **Hyperdrive**：用于连接开发者可能已有的现有 (PostgreSQL) 数据库。
- **Queues**：用于异步处理和后台任务。
- **Vectorize**：用于存储嵌入 (embeddings) 并支持向量搜索（通常与 Workers AI 结合使用）。
- **Workers Analytics Engine**：用于跟踪用户事件、计费、指标和高基数分析。
- **Workers AI**：作为推理请求的默认 AI API。如果用户要求使用 Claude 或 OpenAI，请使用这些 API 对应的官方 SDK。
- **Browser Rendering**：用于远程浏览器能力、网页搜索和使用 Puppeteer API。
- **Workers Static Assets**：用于托管前端应用程序和静态文件，适用于构建需要前端或使用前端框架（如 React）的 Worker。

在代码和 `wrangler.jsonc` 中包含所有必要的绑定，并添加适当的环境变量定义。

## 配置要求

- 始终提供 `wrangler.jsonc`（而不是 `wrangler.toml`）。
- 包含：
  - 适当的触发器（http, scheduled, queues）。
  - 必要的绑定。
  - 环境变量。
  - 兼容性标志。
  - 设置 `compatibility_date = "2025-03-07"`。
  - 设置 `compatibility_flags = ["nodejs_compat"]`。
  - 为 `[observability]` 设置 `enabled = true` 和 `head_sampling_rate = 1`。
  - 仅包含代码中使用的绑定。

## WebSocket 准则

- 在 Durable Object 中提供 WebSocket 处理代码时，你必须使用 **Durable Objects WebSocket Hibernation API**。
- 始终使用 WebSocket Hibernation API 而不是传统的 WebSocket API，除非另有说明。
- 使用 `this.ctx.acceptWebSocket(server)` 来接受 WebSocket 连接，不要使用 `server.accept()` 方法。
- 定义 `async webSocketMessage()` 处理程序接收消息，`async webSocketClose()` 处理程序处理连接关闭。
- 不要在 Durable Object 内部使用 `addEventListener` 模式来处理 WebSocket 事件。
- 显式处理 WebSocket 升级请求，包括校验 Upgrade 请求头。

## AI Agents 与 Workflows

- 在被要求构建 AI Agent 时，强烈建议使用 `agents` 库。
- 使用来自 AI SDK 的流式响应。
- 优先使用 `this.setState` API 管理状态，但在适当时也可以直接使用 `this.sql` 与 SQLite 数据库交互。
- 客户端接口首选 `agents/react` 库的 `useAgent` React hook。
- 继承 `Agent` 类时需提供类型参数：`class AIAgent extends Agent<Env, MyState> { ... }`。
- 在 `wrangler.jsonc` 中包含 Durable Object 绑定，并将 `migrations[].new_sqlite_classes` 设置为 Agent 类名。
- 对于 **Workflows**：通过继承 `WorkflowEntrypoint` 类来定义，在其中定义 `run` 方法，并在调用 `step.do` 或 `step.sleep` 时使用 `await`。

## API 设计模式：WebSocket 协同

用于 WebSocket 的 Fan-in/fan-out 扇入扇出模式。

```typescript
export class WebSocketHibernationServer extends DurableObject {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 推荐模式：调用 acceptWebSocket 告知运行时此 WebSocket 将在此 DO 内终止请求
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    ws.send(message);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, "Message...");
  }
}
```
