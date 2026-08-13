# PRD-018: Markdown 前缀文章导入

> **状态：待实现（Planned）**

## 1. 背景与目标

Dashboard 的文章入口已经支持 URL 采集、普通长文本，以及通过 `RAW:` 前缀触发 AI 整理转写稿。用户还需要一种确定性的 Markdown 导入方式：粘贴以 `MD:` 开头的内容后，系统将 Markdown 转为适合阅读器渲染的 HTML。

本期目标：

- 新增 `MD:`（或 `md:`、`MD：`）前缀作为 Markdown 导入指令。
- 将 Markdown 编译为 HTML，不调用 Workers AI，也不触发 `RAW:` 的 AI 整理逻辑。
- 复用现有分句算法和阅读器的 sentence id 协议，使摘要联动、逐句朗读和高亮继续可用。
- 保留 Markdown 的语义结构，尤其是标题、列表、表格、引用、代码块和图片；链接仅保留其文字内容。

## 2. 触发规则与内容类型

### 2.1 前缀规则

仅当文章为本地纯文本来源（`source_url = "raw.txt"`）且原文开头匹配下列规则时，进入 Markdown 分支：

```ts
/^md[:：]\s*/i
```

规则说明：

- 仅匹配文本起始位置；前置空格、换行或 BOM 不应隐式触发。
- 匹配后移除前缀，剩余内容作为 Markdown 源文。
- `MD:` 与 `RAW:` 互斥；`MD:` 分支优先按 Markdown 处理，绝不调用 Workers AI。
- 无前缀的非 URL 内容保持现有普通纯文本流程不变。

### 2.2 来源与标题

- D1 / Dashboard 的来源显示为 `Markdown`。
- 标题优先取首个一级 ATX 标题（`# 标题`）的纯文本。
- 若没有一级标题，则取第一个非空的可见文本行作为回退标题，并移除 Markdown 标记后截断至既有标题长度。
- 原始 Markdown 始终保留在 `articles/{userId}/{articleId}/raw.txt`；转换后的内容写入既有 `content.html`。

## 3. 处理管线

```text
MD: Markdown 原文
  -> 去除 MD: 前缀
  -> Markdown 编译为 HTML
  -> Markdown 专用安全净化
  -> 在可朗读文本块中注入 sentence id
  -> 写入 content.html
  -> articles.status = ready
```

Markdown 文章复用 `articles` 表、现有 R2 路径、阅读器路由、摘要接口和朗读控制台，不引入新的文章表或阅读器模式。

## 4. 技术设计

### 4.1 Markdown 编译库

本期使用开源库 `marked`：

- 支持常用 Markdown / GFM 语法。
- 依赖和运行时开销较小，适合在 `book-worker` 中执行简单的字符串到 HTML 转换。
- 不引入 `remark` / `rehype` 的完整 AST 生态；如未来需要脚注、数学公式或自定义 AST 转换，再单独评估。

`marked` 的输出不可视为安全 HTML，必须继续进行后续安全净化。

### 4.2 不复用完整 `cleanHtml`

Markdown 生成的 HTML 已有稳定结构，不应送入完整 `cleanHtml` 管线。当前管线包含 DOM 展平、标签剥离、来源兼容修复和排版重组，可能破坏 Markdown 的表格、代码块及标题层级。

Markdown 分支不执行：

- 结构展平和无语义标签剥离。
- 普通网页 / EPUB 的排版修补与段落重组。
- `RAW:` 的 AI 整理步骤。

### 4.3 复用分句逻辑

必须复用 `book-worker/src/utils/sentence.ts` 的 `splitSentences()`，不得新建另一套中文/英文分句规则。

需要将现有“文本节点转换为 `<span class="sentence" id="s-N">…</span>`”的包装逻辑提取为可共享 helper，供普通 `cleanHtml` 和 Markdown 后处理共同使用。

Markdown 后处理仅在下列文本块内分句：

- `p`
- `h1` 至 `h6`
- `li`
- `blockquote`

以下区域不得注入 sentence span：

- `pre`、`code`
- 表格结构与单元格
- 图片及其属性

链接不保留 `<a>` 结构或 `href` 属性，仅保留其文字内容；链接文字可作为其所属文本块的一部分参与分句。

注入后的 span 格式保持与现有阅读器一致：

```html
<span class="sentence" id="s-1">第一句话。</span>
```

这样摘要 Scrollspy、逐句 / 逐词朗读、章节内跳转等既有能力无需引入 Markdown 专用分支。

### 4.4 安全净化与资源策略

Markdown 允许包含原始 HTML、链接和图片，因此不可跳过净化。应配置 Markdown 专用白名单：

- 保留：段落、标题、强调、删除线、列表、引用、表格、代码块、图片、换行及 sentence span。
- 链接：移除 `<a>` 标签及其 `href` 属性，但保留链接文字。
- 移除：脚本、事件属性、内联样式、iframe、表单、嵌入式媒体及其他主动内容。
- 图片：保留远程图片地址及必要属性；`src` 仅允许 `http:` / `https:` 协议，拒绝危险协议、相对路径和本地资源地址。

本期不提供 Markdown 图片上传或本地资源解析；Markdown 中的远程图片遵循现有文章图片渲染与安全策略。

## 5. UI / UX

首版不新增输入框或开关。用户在现有 Dashboard 文章输入区域粘贴：

```md
MD:
# 我的文章

这是一段 **Markdown** 内容。
```

系统仍显示现有的“正在解析文章内容”状态；完成后，文章卡片显示 `Markdown` 来源，进入阅读器后以 Markdown 对应的语义排版展示。

后续可考虑增加显式 Markdown 按钮或输入提示，但不属于本期范围。

## 6. 错误与边界处理

- 空的 `MD:` 内容：文章处理失败并标记为 `error`，返回明确错误日志。
- Markdown 编译或净化失败：不写入半成品 `content.html`，文章标记为 `error`。
- 不允许 AI 整理失败时回退为 Markdown；`MD:` 的处理始终确定性且不依赖 AI。
- 超长 Markdown 需遵循现有文本文章的输入体积限制；本期不额外引入模型 token 限制。
- Markdown 源文中的原始 HTML 仅在白名单与净化策略允许时保留；不能依赖“Markdown 看起来干净”作为安全前提。

## 7. 不包含

- 不实现 Markdown 编辑器、实时预览或格式工具栏。
- 不实现 MDX、JSX、脚本执行或自定义组件。
- 不实现数学公式、脚注、流程图或代码高亮主题。
- 不改变 URL 采集、普通文本、`RAW:` 整理和图片 OCR 的既有流程。
- 不新增 Markdown 专用的数据库 schema、文章类型或阅读器页面。

## 8. 任务清单

- [ ] 在 `book-worker` 引入并锁定 `marked` 依赖。
- [ ] 增加 `MD:` 前缀识别，并与 `RAW:`、普通文本分支明确分流。
- [ ] 实现 Markdown → HTML 转换与标题提取。
- [ ] 实现 Markdown 专用安全净化白名单与 URL 协议限制。
- [ ] 将 sentence span 注入抽为共享 helper，并让 Markdown 分支复用 `splitSentences()`。
- [ ] 覆盖标题、列表、链接文字保留与链接标签移除、引用、表格、代码块、图片与原始 HTML 的渲染回归测试。
- [ ] 覆盖摘要定位、朗读和高亮在 Markdown 段落中的回归测试。
- [ ] 补充 `MD:`、`md：`、空内容、前置空白、与 `RAW:` 互斥等分流测试。

## 9. 验收标准

1. 粘贴以 `MD:`、`md:`、`MD：` 开头的 Markdown 后，文章成功生成并可在阅读器打开。
2. `MD:` 分支不会调用 Workers AI，也不会显示为 `AI 整理文本` 来源。
3. 无前缀文本、`RAW:` 文本和 URL 文章的现有行为不变。
4. Markdown 标题、强调、删除线、列表、引用、表格、代码块和图片的结构得到保留；链接仅保留文字内容。
5. 恶意脚本、事件属性、链接标签与危险图片 URL 协议不会出现在最终 `content.html` 中。
6. `p`、标题、列表和引用中的普通文本具有连续、唯一的 `sentence` / `s-N` 标记。
7. 代码块、表格及图片不会被错误拆句或破坏结构。
8. Markdown 文章中的摘要定位、逐句朗读和句级高亮可正常工作。
9. 空 Markdown 或转换异常会使文章进入 `error` 状态，不生成半成品内容。

---

*Status: Planned*
