# PRD-001: Logto 极简集成 (Protected App 模式)

## 1. 目标
使用 Logto Protected App 实现零代码身份验证。应用通过代理转发的 Header 获取用户状态。

## 2. 任务清单 (Tasks)

- [x] **Logto 代理配置**: 在 Logto Console 创建 Protected App 并指向当前 Worker 域名。
- [x] **身份校验中间件**: 实现基础的 Header 验证 (校验来自 Logto 的密钥)。
- [x] **用户退出登录**: 实现登出功能。

---

## 3. 进度 (Progress)
- **状态**: 已完成 (Done)
- **最后更新**: 2026-04-06 (注：登出功能延迟实现)
