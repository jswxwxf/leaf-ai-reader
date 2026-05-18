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
- 蓝牙耳机/锁屏媒体控制朗读。
- 本地阅读进度、高亮、笔记持久化。

### 2.3 暂缓功能

- 中国区 AI 摘要。
- OCR。
- 云同步。
- 账号系统。
- 跨端内容分发。

以上功能会显著增加合规、隐私、服务端和审核复杂度，应在移动端 MVP 验证后再评估。

广告变现可以作为免费版商业模式预留，但首版实现应保持克制，优先使用固定 banner 等低复杂度广告位，不应为了广告插入破坏阅读器核心架构。

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

最新方向是将移动端版本定位为纯客户端、本地优先应用：

- 不需要登录。
- 不需要服务器端。
- 不需要 Cloudflare Worker / R2 / D1 / OpenNext。
- 用户自有 EPUB 和解析结果保存在本机。
- AI 能力作为可选增强，不影响本地阅读器主流程。

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
Workers AI     -> 可选 AI Provider，不进入本地核心链路
Gemini API Key -> 不内置客户端
Worker RPC     -> 本地 service/controller 函数
Logto/Auth     -> 首版移除
```

本地 App 的推荐调用链：

```text
Reader UI
  -> ReaderService
    -> BookRepository
      -> StorageBackend
      -> MetadataStore
      -> SpeechController
```

不要让 UI 直接读写真实文件路径。业务层只使用 `bookId`、`chapterPath`、`resourcePath` 等稳定标识，真实路径由 storage backend 解析。这样未来接入 iCloud、Google Drive、WebDAV 或其他同步方案时，不需要重写阅读器 UI。

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

### 6.1 存储原则

移动端应延续当前 Web / Worker 版的对象存储思路：

- EPUB 原文件、封面、章节 HTML、图片、CSS、字体等大块内容放文件系统。
- SQLite 只存索引、状态和查询友好的结构化数据。
- 解析产物应可从 `original.epub` 重建。
- 所有持久化路径使用相对路径，不保存沙盒绝对路径。
- 内容和状态拆开保存，方便未来同步和冲突处理。

对应关系：

```text
R2 object    -> local file
D1 row       -> SQLite row
user id      -> local single-user namespace
```

### 6.2 文件目录

建议将 EPUB 原文件、处理后的章节、图片、CSS、字体都保存到 App 沙盒目录。

```text
books/
  {bookId}/
    original.epub
    book-manifest.json
    meta.json
    toc.json
    flatten-chapters.json
    cover.jpg
    chapters/
      chapter-0001.html
      chapter-0002.html
    resources/
      OEBPS/
        Images/
        Styles/
        Fonts/
state/
  {bookId}/
    reading-state.json
    highlights.json
    notes.json
```

示例 `book-manifest.json`：

```json
{
  "schemaVersion": 1,
  "bookId": "book-123",
  "originalPath": "original.epub",
  "tocPath": "toc.json",
  "flattenTocPath": "flatten-chapters.json",
  "coverPath": "cover.jpg",
  "contentDir": "chapters",
  "resourceDir": "resources",
  "processedAt": "2026-05-27T00:00:00.000Z"
}
```

### 6.3 SQLite 表

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

SQLite 中保存的是索引和状态，例如：

- `bookId`
- `title`
- `author`
- `coverPath`
- `tocPath`
- `lastChapterPath`
- `lastSentenceId`
- `updatedAt`

不要把每章 HTML 全量塞进 SQLite。章节 HTML 更适合作为本地文件保存，SQLite 只记录章节路径和状态。

### 6.4 面向未来同步的抽象

首版不做 iCloud，但代码应从一开始面向可替换 storage backend：

```text
LocalFileStorage + SQLiteMetadataStore
```

未来 Apple 平台可以替换或扩展为：

```text
ICloudFileStorage + LocalSQLiteIndex
```

Android 或跨平台同步可以扩展为：

```text
GoogleDriveSyncBackend
WebDAVSyncBackend
DropboxSyncBackend
SyncthingFolderBackend
```

Android 没有与 iCloud Documents 完全等价的系统级 App 私有文档同步。Android Auto Backup 更适合换机或重装恢复，不适合阅读进度的多设备连续同步。若要做 Android 跨设备同步，通常需要接 Google Drive、WebDAV、Dropbox、OneDrive、Syncthing 或自建同步层。

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

首版 demo 可以先用 RN TTS 库验证体验，但产品级版本应预留少量原生开发。原因是后台朗读、蓝牙遥控、锁屏控制、系统音频焦点、背景音乐混音和句级回调都属于平台媒体能力，纯 JS 层难以稳定覆盖。

最新判断：

- iOS 系统 TTS 能提供边界回调，但免费声音质量一般。
- Siri Voice 通常不开放给第三方 App 调用。
- Android 系统 TTS 与 WebView TTS 都需要真机验证，碎片化风险明显。
- 词级高亮是产品核心体验，不应为了更好听的声音牺牲同步高亮。
- 高级云 TTS 只有在能提供 word timestamp / speech marks 时才值得作为高级朗读方案。

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

不要依赖 WebView DOM 临时反查所有句子文本。RN / 原生层应持有权威句子队列和当前句子状态，WebView 负责展示与高亮。

建议扩展字段：

```json
[
  {
    "id": "s-1",
    "text": "第一句话。",
    "chapterPath": "chapter-0001.html",
    "paragraphId": "p-1",
    "index": 0
  }
]
```

### 8.2 原生媒体控制

移动端不应复刻 Web 版的 `navigator.mediaSession` + `silent_31s.m4a` 静音保活方案。该方案是浏览器环境下为了维持系统媒体焦点和蓝牙遥控事件的权宜做法，原生移动端应走系统媒体控制 API。

推荐平台方案：

```text
iOS     -> MPRemoteCommandCenter + MPNowPlayingInfoCenter + AVAudioSession
Android -> MediaSession / Media3 + foreground service + audio focus
```

控制映射：

- `play`：从当前句继续朗读。
- `pause` / `stop`：暂停或停止朗读，按产品语义决定是否保留当前句。
- `nextTrack`：下一句或下一段。
- `previousTrack`：上一句或上一段。

可用 `react-native-track-player` 等库验证锁屏控制和蓝牙遥控事件，但 Leaf 的朗读不是普通音乐队列。若现成库无法精确表达逐句 TTS、背景混音和当前句状态，应实现轻量 Native Module：

```text
SpeechPlaybackController
  iOS: AVSpeechSynthesizer + AVAudioSession + MPRemoteCommandCenter
  Android: TextToSpeech + MediaSession + AudioManager + ForegroundService
```

### 8.3 背景音乐与音频焦点

目标体验：

- Leaf 保持蓝牙遥控和锁屏控制权。
- QQ 音乐、Apple Music、Spotify 等 App 可继续作为背景音乐播放。
- Leaf TTS 在背景音乐之上朗读，必要时短暂降低背景音乐音量。

iOS 方向：

- 使用 `AVAudioSessionCategoryPlayback`。
- 配置 `mixWithOthers`，允许 Leaf 音频与其他 App 混音。
- 可按需短暂使用 `duckOthers`，但不应长时间持续压低其他 App 音量。
- 通过 `MPRemoteCommandCenter` 接收系统和蓝牙遥控事件。

Android 方向：

- 使用 `MediaSession` / Media3 暴露当前朗读会话和控制按钮。
- 使用 audio focus 策略，优先评估 transient may duck / mix 类行为。
- 后台朗读需要 foreground service 和通知控制。

注意：原生方案可以显著优于 Web，但不能保证所有系统、厂商 ROM、蓝牙设备和第三方音乐 App 都完全一致。系统媒体按钮通常只会有一个主要控制目标；目标是让 Leaf 成为控制目标，同时允许其他 App 音频继续混音。

## 9. WebView 通信协议

WebView 与 RN 需要交互，但通信量应控制在事件级别，避免高频 bridge 压力。

### 9.1 职责划分

RN 负责：

- TTS 播放状态。
- 当前句子 ID。
- 权威句子队列。
- 蓝牙/锁屏媒体命令分发。
- 音频焦点与背景音乐混音策略。
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

WebView 不是朗读状态源。它可以上报点击和滚动位置，但不能作为后台朗读、锁屏控制或当前句文本的唯一来源。

如果第一版为了最大复用现有 Web 阅读器能力，可以做一次 WebView TTS spike：

- WebView 内使用 `window.speechSynthesis`。
- WebView 内维护 `onboundary` 高亮。
- RN 通过 bridge 控制 play / stop / next / prev / speechMode。

但该方案只能作为验证或兜底，不建议作为长期 Android 主方案。Android WebView、系统 TTS 引擎、厂商 ROM、中文语音包和 boundary 事件粒度都可能影响体验。

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

## 11. AI 方案补充

移动端本地阅读器可以不依赖 AI。AI 应作为可选 provider 接入，而不是主流程依赖。

Puter.js 值得作为 AI 摘要、解释、翻译、问答的候选方案，因为其模式是 no backend / no API key / user-pays，用户使用自己的额度或自行承担超额成本，App 不需要替用户维护 AI 账单。

推荐抽象：

```ts
interface AiProvider {
  summarize(input: string): Promise<string>;
  translate(input: string): Promise<string>;
  explain(input: string): Promise<string>;
}
```

候选 provider：

```text
NoAiProvider
PuterProvider
LocalModelProvider
OpenAIProvider
```

注意：Puter.js TTS 只有在暴露 word timestamp / speech marks 时，才适合作为高级朗读方案。若只返回音频而没有词级时间轴，则不应替代系统 TTS。

## 12. 广告与商业化补充

移动端免费版可以加入广告，目标是覆盖上架和维护成本。广告应作为可替换 provider 设计：

```ts
interface AdProvider {
  showBanner(placement: AdPlacement): React.ReactNode;
  showInterstitial(placement: AdPlacement): Promise<void>;
  showAppOpen(): Promise<void>;
}
```

建议广告位：

```text
bookshelf_banner
reader_banner
ai_result_native
settings_banner
app_open
import_done_interstitial
chapter_switch_interstitial
```

首版推荐：

- 书架页 banner。
- 阅读页固定 banner。
- AI / 摘要页广告。
- 开屏广告低频展示。
- 插屏广告后续再评估。
- Pro / 付费版隐藏广告。

阅读页第一版建议使用固定 banner，不建议为了让广告跟随正文滚动而重构 WebView 高度自适应。固定 banner 的工程复杂度最低、曝光稳定，也方便后续去广告。

不推荐：

- 正文中间频繁插广告。
- 每翻页或每滚动几屏插广告。
- 广告遮挡正文、朗读控制栏或选择操作。
- 朗读过程中弹出插屏。

章节末尾 native ad 体验较好，但若用户没有读到章节末尾，广告通常不会形成有效曝光。它可以作为后续补充，不应作为首版唯一阅读页广告位。

## 13. 推荐 MVP 里程碑

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
- [ ] 接入蓝牙/锁屏媒体控制。
- [ ] 验证背景音乐混音和音频焦点策略。
- [ ] 保存朗读与阅读进度。

### Phase 4: 阅读器体验补齐

- [ ] 章节前后切换。
- [ ] 高亮和笔记。
- [ ] 滚动位置恢复。
- [ ] 横竖屏和移动端安全区适配。
- [ ] 大文件性能测试。

### Phase 5: 商业化与可选增强

- [ ] 接入广告 provider 抽象。
- [ ] 免费版阅读页固定 banner。
- [ ] Pro 去广告开关。
- [ ] Puter.js AI provider spike。
- [ ] iCloud-ready storage backend 边界检查。

## 14. 非目标

- 不在当前 `frontend/` 或 `book-worker/` 项目中实现。
- 不把当前 Cloudflare Worker 原样移植到 RN。
- 不在客户端保存 Gemini / OpenAI / Workers AI API key。
- 不在首版提供内容平台、书城、新闻采集、公开分享或推荐流。
- 不在首版实现中国区 AI 摘要/OCR 合规闭环。
- 不为首版实现 iCloud / Google Drive / WebDAV 同步，但代码结构应预留 storage backend 和 sync backend。
- 不把高级云 TTS 作为主朗读方案，除非 provider 能提供稳定词级时间轴。

## 15. 状态

- **状态**：归档 / Future Exploration
- **是否进入当前项目活跃列表**：否
- **最近更新**：2026-05-27
- **来源**：围绕 Leaf AI Reader 移动端化、纯客户端本地应用、React Native 本地存储、WebView 渲染、原生 TTS、词级高亮、Puter.js AI、iCloud-ready 架构、Android 同步边界、广告变现和原生媒体控制的方案讨论
