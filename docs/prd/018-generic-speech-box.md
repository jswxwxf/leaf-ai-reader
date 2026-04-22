# PRD-018: 通用型 SpeechBox 朗读控制台组件设计与实现方案

## 1. 背景与目标
在多场景阅读器中，除了正文长文本外，摘要、引言、评论等碎片化文本也有朗读需求。目前的 `use-speech` 逻辑深度绑定了文章结构，难以复用。本 PRD 定义一个自成一体、低耦合的 `SpeechBox` 组件，为任意 UI 提供“点读”能力。

## 2. 核心功能需求

### 2.1 文本内容自动抓取 (Auto Text Extraction)
*   **实现机制**：组件通过 `ref` 引用其根节点，利用 `innerText` 自动获取内部所有子节点的扁平化文本字符串。
*   **优势**：无需开发者手动传输 `text` 属性，直接包裹现有 UI 即可。

### 2.2 无侵入式高亮 (Non-invasive Highlighting)
*   **技术方案**：使用 **CSS Custom Highlight API**。
*   **逻辑方案**：
    *   朗读过程中，根据 `onBoundary` 事件提供的字符偏移量，动态计算目标字符在 DOM 树中的具体 `Range` 范围。
    *   通过 `CSS.highlights.set('speech-box-highlight', highlight)` 进行动态标记。
*   **视觉效果**：在 CSS 中定义 `::highlight(speech-box-highlight)` 的背景色及字体颜色。
*   **优势**：不改变原有 DOM 结构（不增加 `<span>` 标签），对原本包含样式（如加粗、链接）的文本兼容性极佳。

### 2.3 全局单例朗读管理 (Global Singleton)
*   **排他性**：点击任何 `SpeechBox` 时，必须立即调用 `window.speechSynthesis.cancel()`，确保全局范围内只有一个声音在播放。
*   **状态反馈**：组件通过 `isSpeaking` 状态提供视觉反馈（例如边框加亮、出现小喇叭图标等）。

## 3. 技术栈建议
*   **API**：Web Speech API (`speechSynthesis`).
*   **高亮**：`Range`, `CSS.highlights` (原生 API)。
*   **架构**：React `forwardRef` 支持 + `useRef` + `onBoundary` 偏移量计算。

## 4. UI 交互示例 (以 Summary 为例)
1.  用户点击侧边栏的一条核心摘要。
2.  `SpeechBox` 捕获点击，停止正在播放的其他声音。
3.  摘要文字层级上方出现高亮光标，随语音进度扫过文字。
4.  第二次点击或语毕后高亮自动消失。

## 5. 验收标准
1.  包裹含有 `<b>` 或 `<i>` 标签的文本时，高亮能正确穿透标签保持连贯。
2.  朗读过程中点击另一个 `SpeechBox`，前者应立刻静音。
3.  不需要为组件传递任何冗余的文本字段即可生效。
