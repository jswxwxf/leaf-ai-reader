# 编码规范 (Coding Conventions)

本文档记录本项目的编码规范，所有贡献者须遵循以下约定。

---

## TypeScript / React

### Props 类型命名

- 每个组件的 Props 接口统一命名为 `Props`。
- **例外**：当同一文件中存在多个组件各自需要定义 Props 时，才使用 `组件名 + Props` 的格式加以区分（例如 `HeaderProps`、`FooterProps`）。

```tsx
// 正确：单组件文件，直接命名为 Props
interface Props {
  variant?: 'hero' | 'compact';
  onClick?: () => void;
}

export function UploadBook({ variant, onClick }: Props) { ... }

// 正确：多组件文件，加前缀区分
interface HeaderProps { ... }
interface FooterProps { ... }
```

---
