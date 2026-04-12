# PRD 008: AI 内容总结与滚动同步高亮

> **状态：已完成 (Completed)**
> **更新时间：2026-04-12**

## 1. 概述
在阅读器中引入 AI 智能导读功能。该功能通过 AI 对文章内容进行结构化总结，并将生成的总结短句与正文对应的句子（Sentence ID）进行物理绑定。当用户滚动阅读正文时，对应的 AI 总结会自动高亮，提供实时的阅读上下文参考。

## 2. 核心功能设计

### 2.1 数据映射机制 (ID-based Mapping)
*   **锚点绑定**：正文 HTML 中的句子包裹在 `<span id="s-{index}">` 标签中。
*   **总结生成**：AI 返回结构化 JSON：`Array<{ summary: string, start_sId: string }>`。
*   **解析下沉**：摘要解析逻辑统一放在 Store 层的 `parseSummaries` 中，支持标准 JSON 及换行符分隔的旧格式。

### 2.2 滚动同步逻辑 (Scrollspy)
*   **高性能监测**：使用 `Intersection Observer API`。为了极致性能，系统**仅监听**摘要中定义的 `start_sId` 锚点，而非监听全文成百上千个句子。
*   **触发触发区域**：`rootMargin: "0px 0px -80% 0px"`。即当目标锚点进入视口顶部 20% 区域时触发高亮切换。
*   **交互锁 (Manual Scroll Lock)**：
    *   **问题**：手动点击跳转时，滚动过程会穿过中间的锚点，导致触发错误的观察者更新，产生“摘要列表闪烁”现象。
    *   **解决**：引入 `isManualScrolling` 锁定状态。点击时加锁，锁定高亮切换；通过监听 `scrollend` 事件或利用定时器兜底，在停止滚动后自动解锁。

### 2.3 UI/UX 表现
*   **侧边栏导读**：在右侧 `Summary` 组件中展示。
*   **高亮视觉**：使用 `primary/10` 背景色、主色文字及轻微横向位移 (`translate-x-1`)。
*   **布局辅助**：
    *   为正文区增加 `pb-[60vh]` 底部留白，确保文末内容也能滚到视口上方触发高亮。
    *   设置 `scroll-pt-20` 滚动内边距，确保跳转后文字位置自然且落在感应区内。

## 3. 技术路线
1.  **Store 层 (`store.tsx`)**：
    *   管理 `summaries` 预处理数据和 `activeSentenceId`。
    *   封装顶层 Action `_jumpToSentence` 处理复杂的跳转锁逻辑。
2.  **Hook 层 (`use-scrollspy.ts`)**：
    *   封装 `IntersectionObserver` 逻辑，解构组件压力。
    *   使用 `useShallow` 优化状态订阅，减少重绘。
3.  **视图层 (`Content.tsx`, `Summary.tsx`)**：
    *   实现轻量化的 Client Components。

## 4. 开发任务
- [x] 开发 AI 导读接口，支持结构化总结输出。
- [x] 实现高性能 `Intersection Observer` 滚动追踪 Hook。
- [x] 引入 `isManualScrolling` 锁机制消除点击跳转时的摘要闪烁。
- [x] 优化阅读器布局，增加底部留白和滚动内边距。
- [x] 完成逻辑下沉与 `useShallow` 性能重构。
- [x] 代码风格扁平化处理，消除深层嵌套。
