---
description: Cloudflare Workers 高级功能应用示例 (Durable Objects, AI, Workflows, Rendering)
---

# 高级功能应用示例

## Durable Objects WebSocket 与 Alarm 示例

使用 Hibernatable WebSocket API 和 Alarm API 触发任务：

```typescript
import { DurableObject } from "cloudflare:workers";

export class WebSocketAndAlarmServer extends DurableObject {
  async fetch(request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 使用 Hibernation API 告知运行时该 WebSocket 是可休眠的
    this.ctx.acceptWebSocket(server);

    // 设置在 10 秒后触发闹钟处理程序
    let currentAlarm = await this.storage.getAlarm();
    if (currentAlarm == null) {
      this.storage.setAlarm(Date.now() + 10 * 1000);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    ws.send(`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`);
  }

  async alarm(alarmInfo) {
    // 闹钟触发时调用
    if (alarmInfo?.retryCount != 0) {
      console.log(`闹钟重试 ${alarmInfo?.retryCount} 次。`);
    }
  }
}
```

- 设置相关的 `durable_objects` 绑定和 `migrations` 对应关系。

## 静态资源处理

```typescript
export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ name: "Cloudflare" });
    }
    // 默认行为：从 ASSETS 中读取
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

- 在 `wrangler.jsonc` 中配置 `assets` 选项，例如 `"not_found_handling": "single-page-application"`。

## Workflows 处理示例

执行持久性任务：

```typescript
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // 定义带有重试策略的步骤
    const response = await step.do('My First Step', {
      retries: { limit: 5, delay: '5 second', backoff: 'exponential' }
    }, async () => {
      // 步骤逻辑...
    });

    await step.sleep('Waiting...', '1 minute');
  }
}
```

- 需要在 `wrangler.jsonc` 中包含 `workflows` 绑定定义。

## Browser Rendering 使用示例

使用无头浏览器控制网页：

```typescript
import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env): Promise<Response> {
    const { searchParams } = new URL(request.url);
    let url = searchParams.get("url");

    if (url) {
      const browser = await puppeteer.launch(env.BROWSER_RENDERING);
      const page = await browser.newPage();
      await page.goto(new URL(url).toString());
      const text = await page.$eval("body", (el) => el.textContent);
      await browser.close();

      return Response.json({ bodyText: text });
    }
    return Response.json({ error: "missing url" }, { status: 400 });
  },
} satisfies ExportedHandler<Env>;
```

## AI Agents 构建示例

使用 `agents` 库构建智能体：

```typescript
import { Agent, AgentNamespace, routeAgentRequest } from 'agents';
import { OpenAI } from "openai";

export class AIAgent extends Agent {
  async onRequest(request) {
    const ai = new OpenAI({ apiKey: this.env.OPENAI_API_KEY });
    const response = await ai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: await request.text() }],
    });
    return new Response(response.choices[0].message.content);
  }

  async evolve(newInsight) {
    // 集成状态同步 API
    this.setState({
      ...this.state,
      insights: [...(this.state.insights || []), newInsight]
    });
  }
}

export default {
  async fetch(request, env) {
    // 路由寻址逻辑
    return (await routeAgentRequest(request, env)) || Response.json({ msg: 'Not Found' }, { status: 404 });
  }
}
```

- 将 `migrations[].new_sqlite_classes` 值设置为 Agent 类名。

## AI 结构化输出示例

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4o-2024-08-06',
  messages: [{ role: 'user', content: 'Extract event info...' }],
  response_format: {
    type: 'json_schema',
    schema: CalendarEventSchema, 
  },
});
const event = response.choices[0].message.parsed;
```
- 配置模式 (Schema) 并使用 `response_format` 参数获取直接解析后的 JSON。
