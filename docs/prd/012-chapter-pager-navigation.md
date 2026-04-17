# PRD 012: 章节翻页器 (Chapter Pager) 导航功能

## 1. 目标 (Goals)
在阅读器底部控制栏提供“上一章”和“下一章”的快速导航功能，提升电子书阅读模式下的连贯性。

## 2. 核心方案 (Final Architecture)

为了保持 UI 的高度集成与简洁，最终方案未采用独立的 `Pager` 包装器，而是将导航逻辑直接整合进 `Speecher.tsx` 控制台。

- **逻辑层**：
  - **线性索引**：利用在书籍处理阶段生成的 `flattenChapters` 数组。
  - **双向指针**：在 `Speecher` 组件内，通过 `allChapters.findIndex(c => c.path === path)` 实时定位当前章节位置，从而计算出 `prevChapter` 和 `nextChapter`。
- **UI 层**：
  - 采用 **Side-aligned** 布局。
  - 左侧：`<Link>` 指向上一章，且在第一章时自动变为 `pointer-events-none`（半透明禁用感）。
  - 中间：核心播放与设置控件。
  - 右侧：`<Link>` 指向下一章。

## 3. 技术实现细节

### 3.1 状态同步
- **URL 驱动**：使用 Next.js 的 `<Link>` 进行跳转，利用 `Reader` 服务器组件监听 URL 变化，从而触发 Store 中 `content` 和 `path` 的原子更新。
- **自动重定向**：如果用户仅输入 `book_id` 进入阅读器，系统会自动寻找 `bookmark`（书签）或跳转至 `flattenChapters[0]`（第一章）。

### 3.2 性能优化
- **Prefetch**：在 `Link` 组件上设置 `prefetch={false}`，避免在低速网络下过度预取二进制章节内容。
- **影子点击区**：为导航链接增加了 invisible 的扩展点击区域（absolute inset），确保移动端单手操作的准确性。

## 4. UI/UX 规范 (Implemented)

- **左侧**：显示 `< 上一章`。
- **中间**：`ChevronLeft` + `Play/Square` + `SpeecherSettings` + `ChevronRight`。
- **右侧**：显示 `下一章 >`。
- **状态反馈**：当无前置/后置章节时，链接透明度降低，操作失效。

## 5. 任务清单 (Task List)

- [x] **基础设施**：在 `lib/book` 中实现 `getFlattenChapters`。
- [x] **数据集成**：在 `Reader` 服务器组件中预取扁平化目录并同步至 Client Store。
- [x] **UI 开发**：在 `Speecher.tsx` 中集成两侧的跳转链接。
- [x] **交互逻辑**：处理路径编码、禁用状态切换以及与 MediaSession 的协同。

## 6. 进度

- **状态**: 已完成 (Completed)
- **最近更新**: 2026-04-17 (完成导航与 Speecher 的深度集成方案)
