# PRD 005: 阅读器平行路由与拦截布局设计

> **状态：已完成 (Completed)**
> **更新时间：2026-04-10**

## 1. 背景与目标
为了提升用户体验，我们希望在 Dashboard 中点击文章进入阅读器时，阅读器能以全屏遮罩的形式盖在 Dashboard 之上，同时保留 Dashboard 的运行状态（如滚动位置、数据轮询等）。当用户直接通过 URL 访问或刷新阅读器页面时，则只显示纯净的阅读器界面，不加载 Dashboard。

## 2. 核心交互逻辑
- **应用内导航**：从 `/dashboard` 跳转到 `/reader` 时，触发拦截。
  - **视觉表现**：阅读器组件全屏滑入或淡入，Dashboard 在底层可见（或被遮罩层略微调暗）。
  - **状态保持**：Dashboard 依然保持挂载，所有的状态（如正在轮询的文章列表）不会丢失。
- **直接访问/刷新**：直接访问 `/reader` 或在阅读时刷新。
  - **视觉表现**：只显示阅读器 UI，不渲染 Dashboard。
- **退出阅读器**：在拦截模式下，点击关闭按钮执行 `router.back()`，阅读器层消失，直接露出底下的 Dashboard。

## 3. 技术实现方案
利用 Next.js 的 **Parallel Routes** 和 **Intercepting Routes** 特性。

### 3.1 目录结构
```text
src/app/
├── layout.tsx             # 修改根布局，添加 @reader 槽位
├── @reader/               # 平行路由槽位
│   ├── default.tsx        # 默认占位 (返回 null)
│   └── (.)reader/         # 拦截路由 (拦截同级 /reader)
│       └── page.tsx       # 拦截后的 UI，包含全屏遮罩容器
└── reader/
    └── page.tsx           # 真实的阅读器页面
```

### 3.2 布局渲染逻辑
在 `src/app/layout.tsx` 中：
```tsx
export default function RootLayout({ children, reader }) {
  return (
    <html>
      <body>
        <div>{children}</div>
        {/* 当 URL 匹配拦截规则时，此槽位有内容，渲染在 children 之上 */}
        {reader}
      </body>
    </html>
  );
}
```

### 3.3 拦截后的 UI 实现
`@reader/(.)reader/page.tsx` 将作为一个“遮罩层组件”：
- **样式**：固定定位 `fixed inset-0 z-50`，背景色半透明或毛玻璃效果。
- **内容**：复用渲染 `/reader` 核心业务逻辑组件。
- **交互**：点击背景或关闭按钮触发路由回退。

### 3.4 路由回落机制
- 当用户从 `/dashboard` 跳转，URL 匹配拦截规则，`@reader` 槽位被填充。
- 当用户刷新页面，Next.js 会忽略截拦截规则，直接将 `/reader` 渲染到 `children` 槽位。此时 `@reader` 回退到 `default.tsx` (null)。

## 4. 关键点说明
- **代码重用**：阅读器的主要逻辑（文章渲染、章节树等）应解耦为独立组件，以便同时在原始页面和拦截页面引用。
- **零侵入性**：Dashboard 内部组件（如文章卡片）无需感知此逻辑，依然使用标准的 `<Link href="/reader">`。
- **返回逻辑**：使用 `useRouter` 的 `back()` 方法确保返回到 Dashboard 之前的状态。

## 5. 最终实现总结
- **Parallel Routes**：成功在 `layout.tsx` 中使用 `{reader}` 插槽。
- **Intercepting Routes**：通过 `(.)reader` 实现了在不丢失 Dashboard 状态的情况下的全屏弹出效果。
- **状态同步**：引入了 `ReaderStore` (Zustand)，并结合 `createUrlSearchStorage` 实现了 `article_id` 和 `book_id` 与 URL 的自动双向同步。
- **服务器组件兼容**：`Reader` 核心组件保持为 Server Component，通过 `initialState` 由 Page 层下发初始数据，保证了 SEO 与首屏内容。
- **条件渲染**：实现了在 `article` 模式下自动隐藏章节目录侧边栏的逻辑。
