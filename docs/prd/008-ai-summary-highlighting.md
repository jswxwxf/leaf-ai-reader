# PRD 008: AI 内容总结与滚动同步高亮

> **状态：草案 (Draft)**
> **更新时间：2026-04-10**

## 1. 概述
在阅读器中引入 AI 智能导读功能。该功能通过 AI 对文章内容进行结构化总结，并将生成的总结短句与正文对应的句子（Sentence ID）进行物理绑定。当用户滚动阅读正文时，对应的 AI 总结会自动高亮，提供实时的阅读上下文参考。

## 2. 核心功能设计

### 2.1 数据映射机制 (ID-based Mapping)
*   **前提条件**：正文 HTML 必须经过深度清洗，所有句子被包裹在 `<span class="sentence" id="s-{index}">` 标签中（目前微信抓取器已实现，需扩展至全平台）。
*   **总结生成**：调用 LLM 时，将带 ID 的文本序列作为上下文，要求 AI 返回带坐标的 JSON 数据。
    *   **返回格式**：`Array<{ summary: string, start_sId: string }>`。
    *   **逻辑**：`start_sId` 标记了该条总结对应内容的起始坐标。

### 2.2 滚动同步逻辑 (Scroll Animation)
*   **监测方式**：使用 `Intersection Observer API` 监听所有 `.sentence` 元素。
*   **触发区域**：设置 `rootMargin: "0px 0px -90% 0px"`，即当句子进入视口顶部 10% 区域时触发位置更新。
*   **状态管理**：
    1. 前端实时维护 `currentViewingSId`。
    2. 侧边栏总结组件根据该 ID 进行区间匹配计算。
    3. 匹配算法：若 `current_id` >= `Summary[N].start_sId` 且 < `Summary[N+1].start_sId`，则第 N 条总结激活。

### 2.3 UI/UX 表现
*   **侧边栏导读**：在阅读器侧边栏提供“AI 导读”面板。
*   **高亮视觉**：
    *   Active 状态：文字加黑、左侧显示淡色指示条或背景高亮。
    *   Inactive 状态：文字置灰或半透明。
*   **交互跳转**：点击某条 AI 总结，正文自动 `scrollIntoView` 平滑滚动到对应的 `start_sId` 位置。

## 技术路线
1.  **后端**：
    *   抽象通用清洗逻辑，确保所有文章（包括非微信文章）均具备 `s-ID` 特性。
    *   集成 LLM 接口，设计专门的导读总结 Prompt。
2.  **前端**：
    *   实现基于 `Intersection Observer` 的高亮同步 Hook。
    *   开发 `AISummaryPanel` 组件并集成至 Reader 布局。

## 3. 开发任务
- [ ] 开发 AI 导读接口，支持结构化总结输出。
- [ ] 实现前端 `Intersection Observer` 滚动追踪逻辑。
- [ ] 完成侧边栏总结列表的渲染与双向高亮同步。
- [ ] 优化超长文章下的总结展示性能与滚动流畅度。
