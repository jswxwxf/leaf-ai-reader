# PRD 008: 逐句逐词朗读高亮

## 1. 目标 (Objective)

复刻类似 iOS “朗读屏幕”的高级交互体验。在用户调用 TTS（语音合成）朗读文章内容时，提供精确到词的视觉反馈，增强阅读专注度与沉浸感。

## 2. 交互与视觉设计 (Design)

实现 **“双层联动高亮”** 效果：
- **句级高亮 (Sentence Layer)**：当前正在朗读的整句显示蓝色下划线。
- **词级高亮 (Word Layer)**：当前正在播放的单词显示淡蓝色背景色（类似选中文本的效果）。

### 2.1 CSS 样式规范
```css
/* 句子下划线 */
.active-sentence {
  text-decoration: underline;
  text-underline-offset: 4px;      /* 增加呼吸感，避开字母尾巴 */
  text-decoration-thickness: 1.5px;
  text-decoration-color: oklch(0.56 0.21 253);         /* iOS 原生蓝色 */
  text-decoration-skip-ink: none;  /* 确保线条连续 */
}

/* 单词背景色 (使用 Custom Highlight API) */
::highlight(word-focus) {
  background-color: oklch(0.56 0.21 253 / 0.2);  /* iOS 高亮淡蓝透明风格 */
  color: inherit;
}
```

## 3. 技术实现方案 (Technical Plan)

### 3.1 前端准备
1. **内容分句**：利用 `book-worker` 已实现的 `injectSentenceIds` 逻辑，确保 HTML 文本节点被包裹在 `<span class="sentence" id="s-x">` 中。
2. **朗读驱动**：
   - 采用“进一句，读一句”的策略，将每个句子的 `textContent` 传给 `speechSynthesis.speak()`。
   - 这样可以保证 `boundary` 事件返回的 `charIndex` 永远基于当前短句，计算简单且准确。

### 3.2 高亮逻辑 (核心算法)
1. **句子激活** (`onstart`):
   - 根据当前朗读句子的 ID，为对应 `<span>` 添加 `.active-sentence` 类。
   - 调用 `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`。
2. **词级追踪** (`onboundary`):
   - 捕获 `name === 'word'` 的边界事件。
   - 获取 `charIndex`。若引擎未提供 `charLength`，则调用 `Intl.Segmenter` 对句子文本进行现场分析，推算当前词的末尾位置。
   - 创建 `Range` 对象并映射至文本节点。
   - 更新 `CSS.highlights` 注册表中的 `word-focus` 对象。
3. **状态清理** (`onend`):
   - 移除 `.active-sentence`。
   - 执行 `CSS.highlights.clear()`。

## 4. 兼容性与回退策略 (Fallback)

- **支持情况**：`CSS Custom Highlight API` 需 iOS 17.2+ 或 Chrome 105+。
- **降级处理**：
  - 如果检测到 `CSS.highlights` 不可用，或者 `onboundary` 事件在当前引擎下表现极差。
  - **回退方案**：取消词级背景高亮，**仅保留句级下划线高亮**。这能保证核心体验不受损，且不需要复杂的 UI 逻辑。

## 5. 任务清单 (Task List)

- [ ] 在前端阅读器组件中集成 Web Speech API 控制逻辑。
- [ ] 实现基于 ID 定位 `<span>` 并添加 CSS 下划线的逻辑。
- [ ] 封装针对 `charLength` 缺失的 `Intl.Segmenter` 补丁函数。
- [ ] 集成 `CSS Custom Highlight API` 进行词级渲染。
- [ ] (可选) 增加 UI 设置项：允许用户开启/关闭单词高亮。
