# PRD 009: 朗读模式切换 (Speech Modes)

## 1. 目标 (Objective)

在现有的逐句朗读和词级高亮基础上，提供三种不同的朗读模式，以适应不同的阅读需求：
- **逐句朗读 (Sentence)**：每读完一句自动停止，适合跟读、精听。
- **逐段朗读 (Paragraph)**：读到当前段落结束时自动停止。
- **全文朗读 (Article)**：读完一句后自动接续下一句，跨段落连读，直到文章末尾，适合沉浸式听书。

## 2. 核心架构设计思考 (Core Concept)

**保持前后端职责分离，不侵入原有的分句逻辑。**

微信文章爬虫等后端处理流程 (`book-worker`) 生成的结构中，所有的句子本身已经被包裹成了 `<span class="sentence" id="s-x">`，并外包在 `<p>`、`<h1>` 等块级标签内。
为了判断是否“读到段落结尾”，我们**不需要**去修改后端清洗逻辑给数据结构增加 `paragraphId` 等额外标识，也可以避免使用复杂的 CSS 兄弟选择器 (`~`) 所导致的因为内联标签（如 `<b>`、`<em>`）嵌套不同引发的同级元素误判。

我们纯粹依靠前端原生 DOM 树来进行准确判断。

## 3. 技术实现方案 (Technical Plan)

### 3.1 状态管理
在 `useReaderStore` (`frontend/src/app/reader/_store/store.tsx`) 中，已新增 `speechMode` 状态。
```typescript
export type SpeechMode = 'sentence' | 'paragraph' | 'article';
// 并在 InitialState、ReaderState 以及 Zustand 中引入该状态的读写操作。
```

### 3.2 挂载控制中枢：`use-speech.ts`
目前的“跨句接力朗读”控制核心位于 `frontend/src/app/reader/_hooks/use-speech.ts` 的 `utterance.onend` 回调函数中。我们通过在这个特定的生命周期节点切入，决定是否要将焦点传递给下一句。

### 3.3 模式调度逻辑
当当前发声任务结束 (`onend` 触发) 且确定了 HTML 元素 (`el`) 时：

1. **单句模式 (`sentence`)**
   - **高亮接力**：无论如何，只要存在下一句，就将 `speechSentenceId` 更新为 `nextId`，使 UI 高亮并自动滚动到下一句。
   - **播放控制**：停止发音，不触发下一句的 `play()`。

2. **逐段模式 (`paragraph`)**
   - **算法（核心，防嵌套）**：
     ```javascript
     const container = el.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
     const sentencesInContainer = container ? container.querySelectorAll('.sentence') : [];
     const isLastInParagraph = sentencesInContainer[sentencesInContainer.length - 1] === el;
     ```
   - **动作判定**：
     - 如果 `isLastInParagraph` 为 `true`：说明当前段落结束。**高亮移至下一句**，但停止发音。
     - 如果为 `false`：说明段落未完。设置 `nextId` 并**自动继续朗读**下一句。

3. **全文模式 (`article`)**
   - **动作**：只要存在连贯逻辑的下一句，就跨越所有的段落边界继续朗读。
   - **逻辑**：只要能找到 `nextId`，就更新 `speechSentenceId` 并**自动触发播放**。

### 3.4 交互细节保证
- **停止朗读状态下的高亮**：即使模式要求停止（如逐句结束、逐段结束），UI 焦点也必须位于下一句，确保用户按下“空格”或点击“播放”时能直接开始朗读新的内容。
- **递归播放防护**：在全文连读时，采用微秒级延迟（如 `setTimeout`）以确保浏览器合成器状态在两次 `window.speechSynthesis.speak` 之间已完全置位。

## 4. 技术优势分析

1. **强解耦**：将所有模式控制逻辑收敛在 `useSpeech` 的交互中模块中，不会干扰底层的 HTML 净化清洗以及前端的渲染流程。
2. **高健壮性**：`querySelectorAll` 能够扁平化获取父容器内的所有符合 `class` 的节点，完美兼容带有内联富文本（加粗、斜体等导致深度层级变化）的句子，不会出现判断遗漏。
3. **极简的高性能**：仅在每句话发音完全结束并触发事件的那个瞬间才执行一次少量的 DOM 查找，避免了全局状态监听与复杂的虚拟 DOM 差分比对计算。

## 5. 实施状态 (Implementation Status)

- [x] **状态集成**：已在 `useReaderStore` 中完整对接 `speechMode`。
- [x] **调度引擎**：`useSpeech` 已更新，通过 `onend` 生命周期支持三种模式的自动跳转与停止判定。
- [x] **闭包安全**：通过 `useRef` 追踪最新 `speechSentenceId`，解决了 TTS 异步回调导致的重播死循环问题。
- [x] **代码架构**：提取了 `isLastSentenceInParagraph` 工具函数，保持了 Hook 逻辑的纯粹性。

---
*Last Updated: 2026-04-14*
