# PRD-002: 上传图书（MVP）

## 1. 目标

让用户能够从 Dashboard 上传一本 EPUB 文件，上传后图书出现在书架上。

## 2. 方案

由于 Cloudflare Pages/Workers 上部署 Next.js (通过 OpenNext) 在免费版中有脚本大小和一些中间件限制（如 1MB 限制），我们将核心后端逻辑搬迁到一个独立的 **Cloudflare Worker (`book-worker`)**。

前端通过 **Server Action** 作为一个轻量级代理，通过 **Service Binding** 调用 `book-worker`。

```
用户在 Modal 选择 EPUB 文件（Client Component）
  -> 调用 Server Action uploadBook(formData)
  -> Server Action 获取文件，通过 Service Binding 发送给 book-worker
  -> book-worker (Worker) 处理以下逻辑：
      1. 写入 R2 存储桶
      2. 在 D1 记录图书元数据
      3. 异步触发 EPUB 解析 (见 PRD-003)
  -> 前端收到结果，刷新书架
```

> **为何使用 Service Binding?**
> 1. **零成本**: 内部调用不产生额外计费。
> 2. **安全**: 不暴露 API 端口到公网。
> 3. **高性能**: 直接在 Cloudflare 内部路由，低延迟。
> 4. **解耦**: 避开 Next.js 运行时的脚本大小上限，让后端逻辑更自由。

## 3. 基础设施前置条件

- [ ] 创建 R2 存储桶 `leaf-books`
- [ ] 创建 D1 数据库 `leaf-db`
- [ ] **创建 `book-worker` Worker**: 独立的代码仓库或子目录
- [ ] **配置 Binding**:
    - `book-worker`: 绑定 `BOOKS_BUCKET` (R2) 和 `DB` (D1)
    - Next.js 应用: 绑定 `LEAF_API` (Service Binding) 到 `book-worker` Worker

## 4. 任务清单

- [ ] **基础设施部署**: 完成 R2, D1 和 `book-worker` 的初始配置
- [ ] **book-worker 开发**: 实现 `POST /books/upload` 接口，处理文件存储与数据库记录
- [ ] **Next.js Server Action**: 实现 `uploadBook(formData)`，调用 `env.LEAF_API.fetch()`
- [ ] **前端 Modal**: 实现上传弹窗（文件选择 + 拖拽 + 上传中转圈），仅接受 `.epub`
- [ ] **UI 联动**: 点击 Dashboard 中的上传卡片触发 Modal
- [ ] **书架更新**: 上传完成后通过 `revalidatePath` 刷新状态

> MVP 已知限制：上传过程中关闭窗口会导致上传中断，不支持断点续传。EPUB 文件体积小，此限制可接受，后续有需要再引入 TUS 或 S3 Multipart Upload。

## 5. 进度

- **状态**: 待开始 (Pending)
- **依赖**: PRD-001（已完成）
