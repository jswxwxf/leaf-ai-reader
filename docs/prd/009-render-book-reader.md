# PRD 007: 图书 EPUB 实时提取与渲染 (Phase 2)

## 1. 目标

实现在阅读页面内实时从 R2 加载 EPUB 章节并渲染展示的功能。

## 2. 方案
 
基于 PRD-003 生成的 `toc.json`，采用“**按需实时解压 (On-demand Extraction)**”模式。
 
1. **获取目录**: 前端通过 API 获取 R2 中的 `toc.json`，渲染递归目录树。
2. **实时解压**: 当用户进入特定章节时，Worker 从 R2 读取原始 EPUB，实时提取对应 HTML 片段。
3. **流式清洗**: 利用 `HTMLRewriter` 实时剔除冗余标签 (`span`, `font`, `style`)，重写图片资源路径。
4. **资源缓存**: 提取的图片资源异步缓存至 R2 `assets/` 目录，下次请求直接读取缓存。

## 3. 安全性
 
EPUB HTML 内容需过滤后渲染，防止 XSS：
- 使用白名单标签方式清理（`HTMLRewriter` 或 `DOMPurify`）
- 允许标签：常见排版标签（`p`、`h1-h6`、`img`、`em`、`strong` 等）
- 图片 src 仅允许指向 R2 预览代理域名
 
## 4. 任务清单
 
- [ ] **实时解压 API**: 在 `book-worker` 中支持 `/api/books/:id/chapters/*` 接口解压 HTML
- [ ] **流式清洗引擎**: 利用 `HTMLRewriter` 实现 HTML 纯净化与资源路径替换
- [ ] **资源存储策略**: 实现 `getResource` 并支持 R2 自动缓存逻辑
- [ ] **章节平滑切换**: 实现“下一句/上一句”的朗读聚焦与章节间的自动跳转
- [ ] **图片中转 Proxy**: 实现通用图片转发接口，剥离 `Referer` 以突破防盗链

## 5. 进度
 
- **状态**: 待启动 (Pending)
- **依赖**: 
  - PRD-003 (已完成：EPUB 索引生成)
  - PRD-006 (已完成：阅读页基础 UI)
