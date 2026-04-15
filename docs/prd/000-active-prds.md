# 📈 项目活跃需求与进度 (Active PRDs)

本项目采用“需求驱动开发”模式。下表是当前正在进行的特性：

- [x] **PRD-001: Logto 极简集成** ([001-logto-auth.md](./001-logto-auth.md))
- [x] **PRD-002: 上传及管理图书** ([002-book-upload.md](./002-book-upload.md)) — 已支持 Modal 上传、R2 存储及删除管理
- [x] **PRD-003: EPUB 结构解析** ([003-epub-indexing.md](./003-epub-indexing.md)) — 已打通 R2 元数据提取与 TOC 索引生成
- [x] **PRD-004: 网页文章采集与 D1 存储** ([004-web-article-collection.md](./004-web-article-collection.md)) — 已支持自动抓取、R2 持久化与状态轮询
- [x] **PRD-005: 阅读器平行路由与拦截布局** ([005-reader-routing-overlay.md](./005-reader-routing-overlay.md)) — 已实现无损状态切换与 URL 自动同步
- [x] **PRD-006: 采集文章阅读渲染** ([006-render-article-reader.md](./006-render-article-reader.md)) — **[Phase 1]** 已实现内容拉取、安全清洗与前端自动填充
- [x] **PRD-007: AI 内容总结与滚动同步高亮** ([007-ai-summary-highlighting.md](./007-ai-summary-highlighting.md)) — 已实现高性能 Scrollspy、点击跳转锁及 Store 逻辑重构
- [x] **PRD-008: 逐句逐词朗读高亮** ([008-sentence-highlighting.md](./008-sentence-highlighting.md)) — 已实现双层联动高亮系统、TTS 接力朗读及键盘快捷键导航
- [x] **PRD-009: 朗读模式切换** ([009-speech-modes.md](./009-speech-modes.md)) — 已实现三种调度模式与跨闭包陈旧值修复
- [x] **PRD-010: MediaSession 系统级媒体控制** ([010-mediasession-integration.md](./010-mediasession-integration.md)) — 已实现静音保活与系统锁屏媒体控制
- [ ] **PRD-011: 图书 EPUB 实时提取与渲染** ([011-render-book-reader.md](./011-render-book-reader.md)) — **[Phase 2]** 待实现实时解压与图片中转代理
---
*注：本文件由 Agent 动态维护，详细任务请点击 PRD 查看。*
