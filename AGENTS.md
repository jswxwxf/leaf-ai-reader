# Agent 指令与项目指引

## 项目总览

Leaf AI Reader 是一个个人阅读器项目，支持 EPUB 图书、网页文章采集、AI 摘要、TTS 朗读、高亮同步和跨端阅读进度。

代码库按运行环境拆分：

- `frontend/`: Next.js 16 App Router 前端，负责阅读器 UI、Dashboard、API 代理、登录态和 Cloudflare OpenNext 部署。
- `book-worker/`: Cloudflare Worker 后端，负责 EPUB 解析、章节/资源读取、网页文章采集、HTML 清洗、摘要等边缘侧逻辑。
- `docs/prd/`: 需求文档与进度。当前活动列表见 `docs/prd/000-active-prds.md`。
- `agents/`: 项目级编码规范和 Cloudflare Workers 指令资料。

## 必读规则

- 修改 `frontend/` 前，先阅读 `frontend/AGENTS.md`。
- 修改 `book-worker/` 前，先阅读 `book-worker/AGENTS.md`，并按需阅读 `agents/cloudflare-rules/`。
- 通用 TypeScript/React 约定见 `agents/coding-conventions.md`。
- 若涉及 Next.js 16 API、App Router、Route Handlers、缓存、Server/Client Components 等行为，以 `frontend/AGENTS.md` 中的 Next.js 官方文档索引为准。
- 若涉及 Cloudflare Workers、D1、R2、KV、Wrangler、Workers limits 或 Node.js compatibility，先查当前 Cloudflare 官方文档；不要仅凭记忆实现。

## 常用命令

在 `frontend/`:

- `npm run dev`: 启动 Next.js 开发服务。
- `npm run build`: 构建前端。
- `npm run deploy`: OpenNext 构建并部署到 Cloudflare。
- `npm run upload`: OpenNext 构建并上传。
- `npm run preview`: OpenNext 构建并本地预览。
- `npm run cf-typegen`: 生成 Cloudflare 环境类型到 `cloudflare-env.d.ts`。

在 `book-worker/`:

- `npm run dev`: 启动 Wrangler dev，并复用 `../frontend/.wrangler/state`。
- `npm run test`: 运行 Vitest。
- `npm run deploy`: 部署 Worker。
- `npm run cf-typegen`: 生成 Wrangler 类型。

## 开发注意事项

- 这是 TypeScript 项目；保持现有模块风格和命名约定。
- React 单组件文件的 props 接口命名为 `Props`；同文件多个组件时使用 `ComponentNameProps`。
- 前端状态主要使用 Zustand，阅读器相关状态集中在 `frontend/src/app/reader/_store/`。
- Worker HTML 清洗与分句逻辑在 `book-worker/src/utils/`，已有回归测试覆盖微信文章复杂 HTML。
- 涉及 Wrangler bindings 变更后运行对应子项目的 typegen 命令。
- 避免把 secrets、账号、token 或环境私密值写入代码或文档。

## 测试与验证

- Worker 逻辑优先补充或运行 `book-worker/test/` 下的 Vitest。
- 前端改动至少运行相关构建、lint 或手动浏览器验证；如命令不可用，在最终回复里说明。
- 修改阅读器 UI、朗读、高亮、滚动或章节导航时，重点验证移动端视口、Safe Area、动态高度和内容不重叠。

