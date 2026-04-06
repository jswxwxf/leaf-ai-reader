---
description: Cloudflare Workers 基础配置与常用存储示例
---

# 基础配置与存储示例

## Wrangler 配置示例 (wrangler.jsonc)

```jsonc
// wrangler.jsonc
{
  "name": "app-name-goes-here", // 应用名称
  "main": "src/index.ts", // 默认入口文件
  "compatibility_date": "2025-02-11",
  "compatibility_flags": ["nodejs_compat"], // 启用 Node.js 兼容性
  "observability": {
    // 默认启用日志
    "enabled": true
  }
}
```

- 将 `src/index.ts` 设置为主文件默认位置。
- 始终启用 `nodejs_compat` 标志。
- 启用 `observability` 功能以便进行遥测。

## KV 会话身份验证示例

使用 Workers KV 存储会话并使用 Hono 进行请求校验。

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'

interface Env {
  AUTH_TOKENS: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>()
app.use('*', cors())

app.get('/', async (c) => {
  const token = c.req.header('Authorization')?.slice(7);
  if (!token) return c.json({ authenticated: false }, 403);

  const userData = await c.env.AUTH_TOKENS.get(token);
  if (!userData) return c.json({ authenticated: false }, 403);

  return c.json({ authenticated: true, data: JSON.parse(userData) });
});

export default app;
```

- 在 `wrangler.jsonc` 中配置 `kv_namespaces` 绑定 `AUTH_TOKENS`。
- 如果 token 无效或过期，返回 403 HTTP 状态码。

## 队列生产者与消费者示例

用于异步处理消息。

```typescript
interface Env {
  REQUEST_QUEUE: Queue;
  UPSTREAM_API_URL: string;
}

export default {
  async fetch(request: Request, env: Env) {
    const info = { timestamp: new Date(), url: request.url };
    await env.REQUEST_QUEUE.send(info);
    return Response.json({ message: 'Logged' });
  },

  async queue(batch: MessageBatch<any>, env: Env) {
    const requests = batch.messages.map(msg => msg.body);
    // 处理逻辑...
  }
};
```

- 为失败的请求配置 **死信队列 (DLQ)**。
- 使用 `retry_delay`（如 300 秒）延迟重送失败的消息。

## Hyperdrive (PostgreSQL) 连接示例

连接到外部数据库资源。

```typescript
import postgres from "postgres";

export interface Env {
  HYPERDRIVE: Hyperdrive;
}

export default {
  async fetch(request, env) {
    const sql = postgres(env.HYPERDRIVE.connectionString);
    try {
      const results = await sql`SELECT * FROM pg_tables`;
      return Response.json(results);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }
};
```
- 使用 `Postgres.js` 驱动。
- 在 `wrangler.jsonc` 中定义 `hyperdrive` 绑定。
