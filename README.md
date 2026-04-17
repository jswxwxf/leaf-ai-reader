# Leaf AI Reader 🍃

> **极简、高效、智能的下一代个人阅读器**
> 
> 基于 Cloudflare 强大的边缘计算能力，为您提供沉浸式的 EPUB 书籍与 Web 文章阅读体验。

---

## ✨ 核心特性

- 📖 **全能阅读支持**：完美支持标准 EPUB 书籍渲染及 Web 文章一键采集。
- 🤖 **AI 深度摘要**：集成 AI 能力，自动提取文章或章节重点，助您快速掌握核心内容。
- 🎙️ **智能语音朗读 (TTS)**：
  - 支持多语种平滑朗读。
  - **句子级高亮同步**：语音播放到哪，正文就高亮到哪，实现视听同步。
  - **MediaSession 集成**：支持锁屏控制及耳机按键操作。
- 📱 **极致移动适配**：
  - 深度适配 iPhone SafeArea（刘海屏/Home 条）。
  - 采用 Dvh (Dynamic Viewport Height) 解决移动端浏览器 UI 遮挡问题。
- 💾 **多端进度持久化**：阅读进度自动保存至 Cloudflare D1 数据库，随时随地接力阅读。
- ⚡ **极致性能**：基于 Next.js 16 (Turbopack) 开发，服务端重定向跳转，首屏渲染秒开。

## 🛠️ 技术栈

### Frontend
- **Framework**: `Next.js 16 (App Router)`
- **Styling**: `Tailwind CSS v4` + `daisyUI v5` (采用全新的 CSS-first 配置方案)
- **State Management**: `Zustand` (响应式状态机)
- **Animations**: `Vanilla CSS` + `Lucide React`

### Backend & Infrastructure
- **Runtime**: `Cloudflare Workers` + `Node.js Edge Runtime`
- **Database**: `Cloudflare D1` (Serverless SQL)
- **Object Storage**: `Cloudflare R2` (存储 EPUB 源文件及章节缓存)
- **Deployment**: `opennextjs-cloudflare` (OpenNext)

## 📂 项目结构

```text
leaf-ai-reader/
├── frontend/             # Next.js 16 应用，负责 UI 与阅读交互
├── book-worker/          # Cloudflare Worker，负责 EPUB 解析与文章采集逻辑
├── docs/                 # 项目文档与 PRD (基于 Markdown)
└── agents/               # 智能代理相关配置
```


---

**Leaf AI Reader** —— 让阅读回归本质，让边缘计算赋能智能体验。
