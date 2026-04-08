# PRD 004: 网页文章采集与轻量化存储 (KISS 版)

## 1. 概述
为 Leaf AI Reader 引入“文章 (Article)”分类。该功能与现有的 D1 图书系统完全解耦，采用 Cloudflare KV 进行极简存储。
**核心变化**：不再存入 D1 数据库，不占用书架长期配额，每个用户仅自动保留最近采集的 20 篇文章。

## 2. 核心功能设计

### 2.1 采集逻辑：双模驱动 (Dual-Mode)

#### A. 自动模式 (Auto Fetch)
*   **触发**：用户输入网页 URL。
*   **后端流**：`fetch` (带仿冒 Headers) -> `linkedom` (DOM 解析) -> `@mozilla/readability` (正文提取)。
*   **失败处理**：若返回 403、验证码或内容为空，系统自动切换至“手动模式”。

#### B. 手动模式 (Manual Fallback)
*   **场景**：自动抓取由于反爬、登录墙而失败。
*   **操作**：前端提供粘贴区域，引导用户在原网页“全选并复制”，然后“在此处粘贴”。
*   **处理**：提取粘贴内容中的纯净正文，流程同自动模式。

### 2.2 存储方案 (KV)
放弃 D1 存储，直接使用 Cloudflare KV：
*   **Key**: `user:articles:{userId}`
*   **Value**: `Article[]` (JSON 数组)
*   **数据结构**:
    ```typescript
    interface Article {
      id: string;        // UUID
      title: string;
      source_url: string;
      content: string;    // 清理后的 HTML 正文
      excerpt: string;
      createdAt: number;  // 时间戳
    }
    ```

### 2.3 滚动淘汰机制 (Rolling Cache)
*   **触发**：每次成功采集新文章并写入 KV 前。
*   **逻辑**：
    1. 读取当前数组。
    2. 将新页面推入数组顶部 (`unshift`)。
    3. 执行 `slice(0, 20)`，仅保留前 20 条。
    4. 写回 KV。
*   **目的**：无需用户手动管理“书架”，自动维持最新的阅读列表。

### 2.4 图片处理
*   **Proxy 模式**：通过 `api/proxy-img?url=...` 动态转发图片，剥离 `Referer` 以突破防盗链。
*   **KV 优化**：不存储图片二进制或 Base64，确保列表 JSON 不会触发 KV 的 25MB 单值上限。

## 3. UI/UX 表现
*   **入口**：Dashboard 增加“采集文章”按钮。
*   **展示**：在书架顶部或独立区域展示“最近采集的文章”（最多 20 篇）。
*   **状态**：显示加载动效，解析成功后直接跳转至阅读器。

## 4. 开发任务
- [ ] 配置 KV Binding (`ARTICLES_KV`)。
- [ ] 实现基于 `linkedom` + `Readability` 的解析管道。
- [ ] 开发 KV 存储与 LIFO 自动淘汰逻辑。
- [ ] 实现图片中转 Proxy 接口。
- [ ] 前端“手动粘贴”回退逻辑 UI 实现。
