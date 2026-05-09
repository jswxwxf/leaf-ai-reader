# PRD-099: 原生移动端个人图书阅读器方案归档

## 1. 文档定位

本 PRD 用于归档 Leaf AI Reader 迁移为 iOS / Android 原生移动 App 的产品与技术讨论结论。

**重要说明**：本任务不会在当前 Web / Worker 项目中完成，也不进入 `000-active-prds.md` 活跃需求列表。本文仅作为未来新建移动端项目时的产品边界、合规判断和架构参考。

## 2. 产品定位

移动端版本定位为一个轻量的个人图书阅读与朗读工具，类似 Voice Dream Reader 的小型版本。

### 2.1 核心边界

- 用户自行导入 EPUB / 文档。
- App 不提供书籍、不内置书库、不提供书籍下载。
- App 不采集网页文章，不做新闻/文章聚合。
- App 不做公共内容分发、书城、推荐流或热门内容运营。
- 阅读、朗读、高亮、笔记、进度等数据优先在本机保存。

### 2.2 首版建议功能

- 本地导入 EPUB。
- 解析元数据、封面、目录。
- 按需处理章节 HTML。
- WebView 渲染本地章节文件。
- 使用系统 TTS 逐句朗读。
- 朗读句子高亮同步。
- 本地阅读进度、高亮、笔记持久化。

### 2.3 暂缓功能

- 中国区 AI 摘要。
- OCR。
- 云同步。
- 账号系统。
- 广告变现。
- 跨端内容分发。

以上功能会显著增加合规、隐私、服务端和审核复杂度，应在移动端 MVP 验证后再评估。

## 3. 合规与上架原则

### 3.1 中国 App Store

若上架中国大陆 App Store，应保持产品表述为“用户自有内容的阅读与朗读工具”。

在当前产品边界下，通常不应被定位为网络出版、新闻资讯或图书内容平台，因为 App 不提供书籍、不运营内容、不分发图书。

仍需注意：

- Apple 中国大陆上架可能要求 ICP / App 备案信息。
- 个人主体理论上可以备案，但如果长期运营、订阅/IAP、云同步或广告变现，建议使用公司主体。
- 用户协议需明确：用户导入内容应具有合法来源，App 不提供版权内容，不公开传播用户上传内容。
- 中国区首版建议避免 AI 摘要、OCR、仿声、新闻采集和公开分享。

### 3.2 海外上架与广告

海外上架可接入广告平台，广告收入通常由 AdMob / AppLovin / Unity LevelPlay 等平台单独结算，不经 Apple App Store 付款系统。

若收入回到中国境内：

- 个人可绑定国内银行账户接收国际电汇，之后按银行要求结汇。
- 公司主体更适合长期运营、较高收入、订阅/IAP、买量和正规财税处理。
- 无论个人或公司，境外广告收入仍需按中国税务要求申报。

## 4. 技术总体方案

移动端不建议直接复刻 Cloudflare Worker，而应抽取纯 TypeScript 核心逻辑，并用 React Native 的本地存储与原生能力替换云端服务。

```text
book-core
  EPUB parser
  chapter normalize
  sentence split
  HTML cleanup

mobile app
  FileSystem 替代 R2
  SQLite 替代 D1
  WebView 渲染本地 HTML
  Native TTS 替代 speechSynthesis
```

### 4.1 Cloudflare 服务替换关系

```text
Cloudflare R2  -> RN FileSystem
Cloudflare D1  -> RN SQLite
Workers AI     -> 后端 API，不放客户端
Gemini API Key -> 后端 API，不放客户端
Worker RPC     -> 本地 service/controller 函数
```

### 4.2 是否需要本地 Node.js 服务

不作为首选。

Node.js Mobile / `nodejs-mobile-react-native` 可以在 iOS / Android App 中嵌入 Node.js worker，但会增加原生依赖、包体、调试、生命周期和审核复杂度。

Leaf 移动端首版不需要完整 Node runtime。当前 `book-worker` 里真正值得迁移的是 EPUB 解析、章节规范化、分句与 HTML 清洗等纯逻辑。

只有当未来需要大量复用 Node-only 代码、本地 HTTP API 或复杂本地插件系统时，再评估 Node.js Mobile。

## 5. 从 `book-worker` 可复用的部分

### 5.1 不可直接复用

`book-worker/src/index.ts` 绑定 Cloudflare Worker 环境，不能直接在 RN 运行：

- `cloudflare:workers`
- `this.env.LEAF_BOOK_BUCKET`
- `this.env.LEAF_BOOK_DB`
- `this.env.AI`
- Worker RPC / Request / Response 流程

这些应保留在服务端，或改造成独立的移动端 service/controller。

### 5.2 可抽取为 `book-core`

- `EpubParser`
- `normalizeChapters`
- `flattenChapters`
- `splitSentences`
- `toCompactText` 中的纯文本转换逻辑
- HTML 清洗主流程，但需要改造资源路径生成逻辑

### 5.3 需要改造的点

当前 HTML 清洗中图片路径会被重写成 Web API：

```ts
/api/books/${bookId}/resource?path=...
```

移动端应改为注入式 resolver：

```ts
cleanHtml(container, {
  resolveResource: ({ basePath, relativePath }) => localRelativePathOrFileUri
})
```

Web 端传 API URL resolver，RN 端传本地相对路径或 `file://` URI resolver。

## 6. 本地存储设计

### 6.1 文件目录

建议将 EPUB 原文件、处理后的章节、图片、CSS、字体都保存到 App 沙盒目录。

```text
books/
  {bookId}/
    original.epub
    meta.json
    toc.json
    chapters/
      chapter-0001.html
      chapter-0002.html
    resources/
      OEBPS/
        Images/
        Styles/
        Fonts/
```

### 6.2 SQLite 表

建议使用 `expo-sqlite`、`react-native-quick-sqlite` 或其他 RN SQLite 方案。

基础表：

```sql
books
chapters
reading_progress
highlights
notes
speech_state
```

## 7. HTML 渲染方案

首选 WebView 加载本地 HTML 文件，而不是将长 HTML 字符串塞进 WebView。

原因：

- 长章节扩展性更好。
- 图片、CSS、字体资源可以按本地目录组织。
- 更接近真实 EPUB 阅读器。
- 便于后续支持脚注、跨章节链接、主题 CSS、滚动恢复和离线缓存。

推荐流程：

```text
EPUB 导入
  -> 解析 metadata / toc
  -> 按需提取章节 HTML
  -> 清洗并写入本地文件
  -> WebView 加载 chapter.html
  -> 图片/CSS/字体通过相对路径读取
```

iOS 侧加载本地 HTML 时需关注 `allowingReadAccessToURL`，确保章节文件能读取同一书籍目录下的资源。Android 侧需验证 `file://` 本地资源访问策略。

本地 HTTP 服务不是首选。只有当 `file://` 资源访问在双端兼容性上成本过高，或需要高度复用 Web API 路径时，再考虑仅监听 `127.0.0.1` 的本地服务。

## 8. 朗读与高亮同步

React Native 端不应依赖浏览器 `speechSynthesis`。

推荐使用系统原生 TTS：

```text
iOS     -> AVSpeechSynthesizer
Android -> TextToSpeech
```

可选库：

- Expo 项目：`expo-speech`
- Bare RN：`react-native-tts`
- 高级朗读控制：自定义 Native Module

### 8.1 朗读数据结构

章节处理时同时生成：

- `chapter.html`：用于 WebView 展示。
- `sentences.json`：用于 RN TTS 调度。

示例：

```json
[
  { "id": "s-1", "text": "第一句话。" },
  { "id": "s-2", "text": "第二句话。" }
]
```

不要依赖 WebView DOM 临时反查所有句子文本。RN 负责朗读调度，WebView 负责展示与高亮。

## 9. WebView 通信协议

WebView 与 RN 需要交互，但通信量应控制在事件级别，避免高频 bridge 压力。

### 9.1 职责划分

RN 负责：

- TTS 播放状态。
- 当前句子 ID。
- 章节切换。
- 阅读进度保存。
- 高亮/笔记数据。

WebView 负责：

- HTML 渲染。
- 当前句子视觉高亮。
- 句子点击。
- 滚动定位。
- 选择文本。
- 当前可见位置检测。

### 9.2 RN -> WebView

通过 `injectJavaScript` 调用 WebView 内部 runtime：

```ts
window.LeafReader.setActiveSentence("s-123");
window.LeafReader.scrollToSentence("s-123");
window.LeafReader.applyTheme(theme);
window.LeafReader.setHighlights(highlights);
```

### 9.3 WebView -> RN

通过 `window.ReactNativeWebView.postMessage()` 发送事件：

```ts
type FromWeb =
  | { type: "ready"; sentenceIds: string[] }
  | { type: "sentencePress"; id: string }
  | { type: "position"; topSentenceId: string; progress: number }
  | { type: "selection"; text: string; startId: string; endId: string };
```

滚动进度应在 WebView 内部 throttle，例如 500ms 到 1000ms 发送一次。TTS 每读一句注入一次高亮更新即可接受。

## 10. 性能风险

- `fflate.unzipSync` 在大 EPUB 上可能阻塞 JS 主线程。
- 大量图片转 base64 会造成内存压力，不适合作为长期方案。
- 大章节 HTML 渲染需按文件加载，避免一次性塞入字符串。
- EPUB 解析、章节处理和资源提取应分批、按需、可取消。
- 长期可评估 JSI worker、原生模块或后台任务来承载重 CPU 操作。

## 11. 推荐 MVP 里程碑

### Phase 1: 本地图书导入与解析

- [ ] 建立移动端项目。
- [ ] 抽取 `book-core`。
- [ ] 支持导入 EPUB 到本地文件系统。
- [ ] 解析 metadata、cover、toc。
- [ ] SQLite 保存 books / toc / progress。

### Phase 2: 本地章节渲染

- [ ] 按需提取章节 HTML。
- [ ] 清洗 HTML 并生成本地 `chapter.html`。
- [ ] 提取并映射图片/CSS/字体资源。
- [ ] WebView 加载本地章节文件。
- [ ] 支持主题、字号、行距。

### Phase 3: 原生 TTS 与高亮同步

- [ ] 生成 `sentences.json`。
- [ ] 接入 iOS / Android 系统 TTS。
- [ ] 实现逐句朗读。
- [ ] WebView 高亮当前句。
- [ ] 支持句子点击后从该句开始朗读。
- [ ] 保存朗读与阅读进度。

### Phase 4: 阅读器体验补齐

- [ ] 章节前后切换。
- [ ] 高亮和笔记。
- [ ] 滚动位置恢复。
- [ ] 横竖屏和移动端安全区适配。
- [ ] 大文件性能测试。

## 12. 非目标

- 不在当前 `frontend/` 或 `book-worker/` 项目中实现。
- 不把当前 Cloudflare Worker 原样移植到 RN。
- 不在客户端保存 Gemini / OpenAI / Workers AI API key。
- 不在首版提供内容平台、书城、新闻采集、公开分享或推荐流。
- 不在首版实现中国区 AI 摘要/OCR 合规闭环。

## 13. 状态

- **状态**：归档 / Future Exploration
- **是否进入当前项目活跃列表**：否
- **最近更新**：2026-05-09
- **来源**：围绕 Leaf AI Reader 移动端化、App Store 合规、React Native 本地存储、WebView 渲染和原生 TTS 的方案讨论
