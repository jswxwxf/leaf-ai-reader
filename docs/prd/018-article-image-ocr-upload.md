# PRD-018: 粘贴图片创建文章 MVP

## 1. 背景与目标
当前 Dashboard 的文章入口已经支持 URL 采集和长文本粘贴。用户希望也能像 Gemini 输入框一样，直接粘贴截图或图片，将图片中的文字识别为文章内容，并进入现有阅读器流程。

本 PRD 的目标是实现一个最小可用版本：用户在文章输入区域粘贴或选择图片后，系统使用现有 Gemini OCR 能力提取文字，再复用 PRD-016 的长文本上传管线生成可阅读文章。

## 2. 范围

### 2.1 本期包含
- 支持在 Dashboard 文章输入区域粘贴图片。
- 检测到图片后隐藏文本输入框，显示图片附件图标列表和一个“添加图片”按钮。
- 每张图片显示一个独立附件图标，不展示缩略图。
- 每个附件图标右上角提供删除按钮。
- 点击“添加图片”按钮可选择本地图片。
- 提交后将图片存入对应 article 的 R2 目录。
- 使用现有 `book-worker.processOCR()` 的 Gemini OCR 思路识别图片文字。
- 将 OCR 结果合并并写入 `raw.txt`。
- 后续处理复用现有长文本文章逻辑：`raw.txt -> cleanHtml -> content.html -> articles.ready`。
- 删除 article 时清理该 article 目录下的图片与派生文件。

### 2.2 本期不包含
- 不接入 Azure AI Vision OCR。
- 不展示图片预览或缩略图。
- 不支持图片和文本同时作为同一篇文章提交。
- 不做 OCR 结果手动编辑界面。
- 不做多 OCR 引擎切换 UI。

## 3. 用户体验

### 3.1 初始状态
Dashboard 文章入口保持现有表现：

```text
[ 粘贴文章网址或长文本内容... ] [ 阅读 ]
```

### 3.2 粘贴图片后
当用户在文章输入区域粘贴一张或多张图片：

```text
[ 图片附件 x ] [ 图片附件 x ] [ + ] [ 阅读 ]
```

- 文本输入框隐藏。
- 图片按粘贴顺序追加。
- `+` 按钮用于继续选择图片。
- 继续粘贴图片时追加附件。
- 删除全部图片后恢复文本输入框。

### 3.3 Paste 监听
因为图片模式下文本输入框会消失，paste 事件不能只绑定在 `textarea` 上。

推荐将 paste 监听绑定在上传表单或其外层容器上，并让附件区域或 `+` 按钮保持可聚焦，避免全局监听干扰其他输入框。

## 4. 数据流

### 4.1 上传与持久化
前端使用 `FormData` 提交：

```text
images[]: File
```

API 创建 article 后，将图片保存到：

```text
articles/{userId}/{articleId}/images/0.png
articles/{userId}/{articleId}/images/1.jpg
```

建议保存真实 `contentType`，供后续 Gemini inline image 使用。

### 4.2 OCR 到长文本
图片文章不是新的文章处理类型，而是长文本文章的一种前置来源：

```text
images -> Gemini OCR -> rawText -> raw.txt -> processArticle(raw.txt)
```

OCR 完成后写入：

```text
articles/{userId}/{articleId}/raw.txt
```

D1 article 元数据建议：

```text
source = "图片识别"
source_url = "raw.txt"
status = "processing"
```

随后调用现有：

```ts
env.BOOK_WORKER.processArticle(user.sub, articleId)
```

`processArticle()` 识别 `source_url === "raw.txt"` 后继续复用 PRD-016 的长文本处理逻辑。

### 4.3 最终文件结构
图片文章最终结构：

```text
articles/{userId}/{articleId}/
  images/0.png
  images/1.jpg
  raw.txt
  content.html
```

可选调试文件：

```text
articles/{userId}/{articleId}/ocr.json
```

MVP 可先不存 `ocr.json`。

## 5. OCR 方案

### 5.1 MVP 使用 Gemini
当前 `book-worker` 已存在 `processOCR()`，使用 `gemini-2.5-flash` 进行图片文字识别，并已有 API key 轮换逻辑：

- `GEMINI_API_KEY`
- `GEMINI_API_KEY_B`
- `GEMINI_API_KEY_C`
- `GEMINI_API_KEY_D`

本期优先复用这套能力，不接 Azure。

### 5.2 推荐重构
为避免复制逻辑，建议将 Gemini OCR 核心抽出：

```ts
private async _runGeminiOCR(bytes: Uint8Array, mimeType: string): Promise<string>
```

然后：

- 现有 `processOCR()` 继续服务阅读器图片按钮。
- 新的图片文章上传流程读取 R2 图片后调用 `_runGeminiOCR()`。

### 5.3 Prompt 要求
Gemini OCR prompt 应强调：

- 提取图片中的正文文字。
- 忽略浏览器 UI、状态栏、按钮、广告、评论区等非正文内容。
- 合并由于截图或排版造成的错误换行。
- 不总结、不改写、不翻译。
- 输出纯文本。

## 6. 删除与清理

删除 article 时，需要清理对应 R2 前缀：

```text
articles/{userId}/{articleId}/
```

该前缀下可能包含：

- `images/*`
- `raw.txt`
- `content.html`
- 未来可能的 `ocr.json`

实现建议：

1. D1 删除或标记删除，让用户立即看不到该 article。
2. 使用 `ctx.waitUntil()` 后台清理 R2 前缀。
3. 如果 R2 清理失败，记录日志，后续可由定期清理任务兜底。

## 7. 限制与校验

- 仅接受 `image/png`、`image/jpeg`、`image/webp`。
- 建议最多上传 5 张图片。
- 建议限制单张图片大小，MVP 可先限制 4 MB。
- 保持图片提交顺序，OCR 文本按顺序合并。
- OCR 失败时将 article 状态更新为 `error`。
- 提交成功后清空附件状态。

## 8. 验收标准

1. 用户可以在 Dashboard 文章输入区域粘贴图片。
2. 粘贴图片后文本输入框消失，显示每张图片对应的附件图标和删除按钮。
3. 删除所有图片后文本输入框恢复。
4. 点击 `+` 可以继续选择图片。
5. 提交图片后，图片被保存到对应 article 的 R2 目录。
6. 系统使用 Gemini OCR 识别图片并生成 `raw.txt`。
7. 图片文章后续复用长文本流程，最终生成 `content.html` 并可在阅读器打开。
8. 删除 article 后，对应 R2 前缀下的图片与派生文件被清理。

---
*Status: Planned*
