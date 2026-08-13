# PRD-021: Demo 用户资源限制与功能隔离

## 1. 背景与目标

项目需要提供一个可公开试用的 Demo 账号：

```text
testdev2013@outlook.com
```

该账号用于让新用户快速体验 Leaf AI Reader 的核心阅读和朗读能力，但不能消耗过多 Cloudflare Worker、R2、D1、AI OCR、摘要、网页采集等资源。

本 PRD 的目标是按 Logto 用户 ID（`sub`）识别 Demo 用户，并为该用户启用轻量资源保护：

- 同一时间只允许拥有一本 EPUB 图书。
- 允许删除当前图书后重新上传，提升公开 Demo 的可试错体验。
- 允许阅读并朗读当前唯一图书。
- 禁用网页文章、AI 摘要、OCR 等高成本功能。
- 前端隐藏或禁用入口，frontend API Route 层强制拦截，避免用户通过 DevTools 直接调用接口消耗资源。
- `book-worker` 当前通过 Cloudflare Service Binding RPC 被 frontend 调用，不直接接收 Logto 身份；本期不要求在 `book-worker` 内按 Demo 用户判断，但需要关闭或收紧其公网 HTTP 入口。

## 2. 用户与权限模型

### 2.1 Demo 用户识别

MVP 阶段不依赖邮箱。当前 Logto ID Token 在服务端可稳定拿到 `sub`，但不保证每次都带 `email`，因此按 `sub` 硬编码识别：

```ts
user.sub === "vzqf2no2raqt"
```

Demo 登录邮箱仍是：

```text
testdev2013@outlook.com
```

后续如需要更多 Demo 用户，再迁移到数据库字段：

```text
users.plan = "demo"
```

或统一的 entitlement 表。

### 2.2 Access 表

建议抽象一个统一 access 判断。当前是临时 Demo 方案，字段保持粗粒度：

```ts
type UserAccess = {
  isDemoUser: boolean;
  maxBooks: number | null;
  canUploadBook: boolean;
  canDeleteBook: boolean;
  canUseArticles: boolean;
  canUseSummary: boolean;
  canUseOcr: boolean;
};
```

Demo 用户推荐能力：

```text
maxBooks = 1
canUploadBook = true, but only while current book count is 0
canDeleteBook = true
canUseArticles = false
canUseSummary = false
canUseOcr = false
```

### 2.3 代码级开关

本期不做后台配置 UI，但 access 模块应支持通过改代码临时开关 Demo 限制，方便在特殊情况下短时间打开某些能力。

建议提供一个集中配置对象，例如：

```ts
const DEMO_ACCESS_OVERRIDES = {
  maxBooks: 1,
  canUseArticles: false,
  canUseSummary: false,
  canUseOcr: false,
};
```

如需临时放开能力，只改这一处配置：

```ts
const DEMO_ACCESS_OVERRIDES = {
  maxBooks: null,
  canUseArticles: true,
  canUseSummary: true,
  canUseOcr: true,
};
```

该开关属于临时运营手段，不应暴露到客户端配置、URL 参数或用户可控输入。部署后生效。

## 3. 功能范围

### 3.1 本期包含

- 按 Logto `sub` 识别 Demo 用户：`vzqf2no2raqt`。
- Demo 用户同一时间最多拥有一本 EPUB 图书。
- Demo 用户已有一本图书时，不允许继续上传。
- Demo 用户可以删除当前图书，并在删除后重新上传一本新图书。
- Demo 用户可以打开并阅读自己的当前图书。
- Demo 用户可以使用图书的基础朗读能力。
- Demo 用户不能访问或创建网页文章、粘贴文本文章、图片 OCR 文章。
- Demo 用户不能触发 AI 摘要生成、摘要重刷、自定义摘要 AI 润色等功能。
- 前端 Dashboard、Reader、上传弹窗、文章入口、摘要入口根据 access 表隐藏或禁用相关入口。
- frontend Route Handler 在入口处强制校验并拒绝高成本操作。
- `book-worker` 作为内部 RPC 服务继续只信任 frontend 调用；本期不通过公网 HTTP 暴露业务处理能力。

### 3.2 本期不包含

- 不做完整付费套餐系统。
- 不做后台管理界面。
- 不做多 Demo 用户配置 UI。
- 不做复杂额度计费。
- 不做运行时权限开关；如需临时放开，通过修改 access 模块代码并重新部署完成。
- 不做“永久锁定一本书”的上传锁；Demo 用户可删除后重传。
- 不做复杂防滥用限流；如后续发现恶意上传，再增加文件大小限制、频率限制或 Cloudflare WAF/Rate Limiting。

## 4. 前端体验

### 4.1 Dashboard

Demo 用户登录后：

- 如果尚未上传图书，保留 EPUB 上传入口。
- 如果已经有一本图书，上传入口置灰或隐藏，并提示 Demo 账号仅支持一本书。
- 文章采集入口、粘贴文本入口、图片 OCR 入口隐藏或禁用。
- 图书列表只展示该用户已有图书。
- 删除按钮对 Demo 用户保留；删除后可重新上传一本 EPUB。

### 4.2 Reader

Demo 用户打开自己的图书时：

- 正文阅读正常。
- 章节导航正常。
- 图书朗读正常。
- 阅读进度同步可保留。
- 高亮同步如成本低可保留；若后续发现写入量过高，可单独加限制。
- 摘要面板、摘要刷新、AI 摘要相关按钮隐藏或禁用。
- 文章阅读器相关入口不可访问。

### 4.3 错误提示

当 Demo 用户尝试访问禁用功能时，前端展示明确提示：

```text
Demo 账号仅开放一本图书的阅读与朗读体验。
```

## 5. 服务端拦截要求

前端 UI 限制只用于体验优化，资源保护必须在 frontend API Route 层完成。

当前部署采用 Logto Protected App 模式：

- Logto 将 `Logto-ID-Token` 注入到访问 `frontend` 的请求 header。
- `frontend/src/lib/auth.ts` 在服务端验证该 token，并解析出 `sub / name` 等字段；当前不能稳定依赖 `email`。
- `frontend` 通过 `BOOK_WORKER` Service Binding RPC 调用 `book-worker`。
- RPC 调用不会自动携带浏览器请求 header，`book-worker` 当前只能看到调用方传入的 `userId = user.sub`。

因此，本期 Demo 用户按 `sub` 识别与强制拦截应放在 `frontend` API Route 层，而不是依赖 `book-worker` 自己读取当前登录用户。

### 5.1 上传图书

上传接口需要：

1. 获取当前用户。
2. 判断是否 Demo 用户。
3. 若是 Demo 用户，查询已有图书数量。
4. 若已有图书数量大于等于 1，拒绝上传。
5. 若没有图书，允许上传并进入现有 EPUB 处理流程。

推荐错误码：

```text
DEMO_BOOK_LIMIT_REACHED
```

### 5.2 删除图书

Demo 用户允许删除自己的图书。删除本身不是高成本能力，并且允许用户在公开 Demo 中修正误传图书。

删除后，Demo 用户当前图书数量回到 0，可重新上传一本 EPUB。上传接口仍需保证同一时间最多一本。

### 5.3 图书读取与资源读取

Demo 用户只能访问自己账号下的图书资源：

- 图书元数据。
- 章节 HTML。
- EPUB 内图片、CSS 等资源。

如果请求不属于该用户的图书，沿用现有未授权处理。

### 5.4 图书朗读

Demo 用户只允许朗读自己当前图书中的内容。

如果当前 TTS 逻辑完全运行在浏览器 Web Speech API 中，主要风险较低；如果存在后端 TTS、AI 语音或 Worker 文本生成接口，则必须增加：

- book ownership 校验。
- Demo 用户只能请求自己的当前 bookId。
- 禁止文章、摘要、OCR 结果等非图书内容的后端朗读。

推荐错误码：

```text
DEMO_TTS_SCOPE_DENIED
```

### 5.5 文章与 AI 功能

以下接口对 Demo 用户直接拒绝：

- URL 文章采集。
- 粘贴长文本创建文章。
- 粘贴图片 OCR 创建文章。
- 图片 OCR。
- AI 摘要生成。
- 手动重刷摘要。
- 摘要片段 AI 生成或润色。

推荐错误码：

```text
DEMO_FEATURE_DISABLED
```

## 6. Worker 与 Cloudflare 资源保护

### 6.1 当前 RPC 边界

`book-worker` 当前是一个内部处理服务，核心业务通过 Cloudflare Service Binding RPC 调用：

```ts
env.BOOK_WORKER.processBook(user.sub, bookId)
env.BOOK_WORKER.processArticle(user.sub, articleId)
env.BOOK_WORKER.processSummary(user.sub, type, id, path)
env.BOOK_WORKER.processOCR(user.sub, params)
```

外部用户不能直接通过 HTTP 调用这些 RPC 方法。只要所有高成本能力都必须先经过 `frontend` API Route，Demo guard 放在 `frontend` API Route 层即可阻止资源消耗。

### 6.2 公网入口收紧

虽然 RPC 方法不能被外部直接调用，但 `book-worker` 仍可能因为 `workers.dev` 或自定义 route 存在公网 HTTP 入口。

本期建议在 `book-worker/wrangler.jsonc` 显式关闭 `workers.dev`：

```jsonc
{
  "workers_dev": false
}
```

并确认没有为 `book-worker` 配置公开业务 route。

如果保留 `fetch()` 用于健康检查，应只返回静态健康信息，不暴露任何会触发 R2、D1、OCR、AI、网页采集或 EPUB 解析的业务能力。

### 6.3 未来兜底策略

如果未来出现以下情况，再考虑把 access 或 Demo 上下文传入 `book-worker` 做二次校验：

- 新增其他 Worker、Cron、Queue consumer 调用 `book-worker`。
- `book-worker` 暴露新的公网 HTTP 业务接口。
- 需要从 Worker 层统一审计或限流高成本任务。
- 希望 Worker 方法在被误用时也能自我拒绝 Demo 用户任务。

届时可以将 RPC 签名扩展为：

```ts
type WorkerCallerContext = {
  userId: string;
  isDemoUser: boolean;
};
```

并让高成本方法接收上下文：

```ts
processSummary(caller: WorkerCallerContext, type, id, path)
processOCR(caller: WorkerCallerContext, params)
```

当前版本不要求 `book-worker` 直接按 Demo 用户拒绝以下方法，因为 Demo 用户无法绕过 frontend API Route 直接调用 RPC：

- EPUB 解析：只允许 Demo 用户在当前无书时触发。
- 网页采集：Demo 用户拒绝。
- HTML 清洗与文章处理：Demo 用户拒绝文章来源。
- Gemini OCR：Demo 用户拒绝。
- AI 摘要：Demo 用户拒绝。

这些限制均由 frontend API Route 负责在调用 `BOOK_WORKER` 前完成。

## 7. 数据与状态

### 7.1 MVP 不新增表

本期可以不改 D1 schema，仅通过当前登录用户 `sub` 和现有 book count 判断。

当前规则是“同一时间最多一本书”，不是“终身只允许上传一本书”。删除后可重传，因此不需要记录 `demo_upload_locked`。

### 7.2 可选后续字段

未来如果需要运营多个 Demo 用户，可增加：

```text
users.plan: "free" | "demo" | "personal"
users.demo_book_id: string | null
users.demo_upload_locked: boolean
```

`demo_upload_locked` 可用于处理“上传过但后来删除/失败”的精确限制。
如果未来发现公开 Demo 被反复上传 EPUB 消耗资源，可再增加该字段或独立审计表。

## 8. Cloudflare 费用与风险控制

当前账号处于 Cloudflare Free plan，但已绑定银行卡。Free plan 下 Workers AI、D1 等通常在超过免费额度后返回错误；但 R2 属于 usage-based 产品，有免费额度，超出后可能产生费用。

当前项目资源风险排序：

- EPUB 上传/删除重传：主要消耗 R2 存储、R2 Class A/B 操作和 Worker 解析请求，风险相对可控。
- 图书章节与资源读取：主要消耗 R2 Class B 操作，免费额度较高。
- 网页采集、OCR、AI 摘要：更容易消耗 Worker、外部 fetch、AI/OCR 相关额度，应对 Demo 用户禁用。

建议在 Cloudflare Dashboard 创建预算警报：

```text
Manage Account → Billing → Billable Usage → Create budget alert
```

建议阈值：

```text
$1 早提醒
$5 严重提醒
```

Budget alert 只发送邮件提醒，不会自动停止服务或阻止继续计费。若后续担心恶意上传，可追加：

- EPUB 文件大小限制，例如 20MB 或 50MB。
- Demo 用户上传频率限制。
- Cloudflare WAF / Rate Limiting。
- 将 Demo 用户改为固定示例书且禁止删除重传。

## 9. 实现建议

### 9.1 统一 Access 模块

建议在前端/API 可共享的位置提供：

```ts
const DEMO_USER_SUBS = new Set(["vzqf2no2raqt"]);

const DEMO_ACCESS_OVERRIDES = {
  maxBooks: 1,
  canUseArticles: false,
  canUseSummary: false,
  canUseOcr: false,
};

function getUserAccess(user: { sub?: string | null }): UserAccess;

async function checkBookUploadAccess(params: {
  access: UserAccess;
  env: CloudflareEnv;
  userId: string;
}): Promise<AccessGuardResult | null>;
```

避免在多个 API 文件中散落 Demo 用户 `sub`、book count 查询和错误格式。

### 9.2 API Guard

建议封装：

```ts
checkBookUploadAccess({ access, env, userId });
checkArticleAccess(access);
checkSummaryAccess(access);
checkOcrAccess(access);
```

Guard 应返回统一 JSON 错误格式，方便前端显示。

推荐错误格式：

```json
{
  "success": false,
  "code": "DEMO_FEATURE_DISABLED",
  "error": "Demo 账号仅开放一本图书的阅读与朗读体验。"
}
```

### 9.3 前端 UI

前端不要写死 Demo `sub`，优先由当前 session 派生 access，然后组件只读能力：

```ts
if (!access.canUseOcr) {
  // hide or disable image OCR entry
}
```

## 10. 验收标准

1. Demo 用户第一次上传 EPUB 成功。
2. Demo 用户已有一本图书后，无法通过 UI 上传第二本。
3. Demo 用户绕过 UI 直接请求上传接口时，服务端返回 `DEMO_BOOK_LIMIT_REACHED`。
4. Demo 用户可以删除已有图书。
5. Demo 用户删除后可以重新上传一本 EPUB。
6. Demo 用户可以打开并阅读自己的当前图书。
7. Demo 用户可以朗读自己的当前图书。
8. Demo 用户无法创建 URL 文章、粘贴文本文章或图片 OCR 文章。
9. Demo 用户无法触发 AI 摘要、摘要重刷、OCR 等高成本 Worker 功能。
10. 非 Demo 用户现有上传、删除、文章、OCR、摘要、朗读功能不受影响。
11. 禁用功能均有清晰提示或统一错误返回。
12. `book-worker` 的 `workers.dev` 公网入口被显式关闭，或确认其公网 HTTP 入口不暴露任何业务处理能力。
13. Cloudflare Billable Usage 中已创建低阈值 budget alert，至少包含 `$1` 或 `$5` 警报。

## 11. 测试建议

- 使用 `testdev2013@outlook.com` 登录进行手动验收。
- 准备一个普通用户账号，回归确认正常功能不受影响。
- API 层补充至少以下测试：
  - Demo 用户已有一本书时上传被拒绝。
  - Demo 用户删除图书后可重新上传。
  - Demo 用户文章创建被拒绝。
  - Demo 用户摘要生成被拒绝。
  - Demo 用户 OCR 被拒绝。
  - 普通用户不受 Demo guard 影响。
- 部署前确认 `book-worker/wrangler.jsonc` 已显式设置 `workers_dev: false`，或 Cloudflare Dashboard 中 `book-worker` 无公开业务 route。
- 部署后观察 Cloudflare Billable Usage 和 R2 用量，确认没有异常增长。

---
*Status: Planned — updated after decision: Demo users may delete and re-upload one EPUB at a time; article/OCR/summary remain disabled.*
