# 📈 项目活跃需求与进度 (Active PRDs)

本项目采用“需求驱动开发”模式。下表是当前正在进行的特性：

- [x] **PRD-001: Logto 极简集成** ([001-logto-auth.md](./001-logto-auth.md))
- [x] **PRD-002: 上传及管理图书** ([002-book-upload.md](./002-book-upload.md)) — 已支持 Modal 上传、R2 存储及删除管理
- [x] **PRD-003: EPUB 结构解析** ([003-epub-indexing.md](./003-epub-indexing.md)) — 已打通 R2 元数据提取与 TOC 索引生成
- [x] **PRD-004: 网页文章采集与 D1 存储** ([004-web-article-collection.md](./004-web-article-collection.md)) — 已支持自动抓取、R2 持久化与状态轮询
- [x] **PRD-005: 阅读器平行路由与拦截布局** ([005-reader-routing-overlay.md](./005-reader-routing-overlay.md)) — 已实现无损状态切换与 URL 自动同步
- [/] **PRD-006: 采集文章阅读渲染** ([006-render-article-reader.md](./006-render-article-reader.md)) — **[Phase 1]** 已完成目录集成，正文拉取 API 开发中
- [ ] **PRD-007: 图书 EPUB 实时提取与渲染** ([007-render-book-reader.md](./007-render-book-reader.md)) — **[Phase 2]** 待实现实时解压与图片中转代理
- [x] **PRD-008: AI 内容总结与滚动同步高亮** ([008-ai-summary-highlighting.md](./008-ai-summary-highlighting.md)) — 已实现高性能 Scrollspy、点击跳转锁及 Store 逻辑重构

---
*注：本文件由 Agent 动态维护，详细任务请点击 PRD 查看。*
