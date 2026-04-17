# PRD 013: 多级 HTML 清洗与排版精美化 (Multi-stage HTML Cleaning)

## 1. 目标 (Goals)

1. **逻辑解耦**: 将 HTML 的“结构转换”与“排版打磨”逻辑分离，解决 `transformNode` 函数日益臃肿的问题。
2. **核心微调**: 持续优化“一次清洗（数字化转换）”的精准度，包括标签映射、句子切分边缘情况处理。
3. **提升健壮性**: 针对不同来源（EPUB、微信、网页）的顽固排版问题，提供更灵活的修正手段。
4. **极简维护**: 针对排版细节的调整（如空格、空行）无需修改核心递归逻辑，通过二次清洗直接处理输出字符串。

## 2. 核心架构：四阶段清洗管道 (Cleaning Pipeline)

我们将清洗流程标准化为以下四个阶段：

### Phase 1: Normalization (Pre-pass / DOM 级)
- **职责**: 简化原始 DOM。
- **动作**: 移除无效标签、展平嵌套的 `div`、处理非标准属性。
- **状态**: 已有初步实现 (`normalizeStructure`)。

### Phase 2: Digitalization (Main-pass / 递归级)
- **职责**: 结构标准化与分句。
- **动作**: 
    - **持续微调**: 优化现有的标签过滤规则，提高对复杂嵌套结构的识别率。
    - 将 EPUB/HTML 标签映射为标准的 `p`, `h1-h6`, `img` 等。
    - 注入句子 ID (`s-N`)。
    - 处理图片路径重写。
- **状态**: 核心稳定逻辑。

### Phase 3: Refinement (Secondary-pass / 字符串级) —— **本次重点**
- **职责**: 排版细节打磨。
- **动作**: 
    - **清理空行**: 移除所有类似于 `<p></p>` 或 `<p>&nbsp;</p>` 的多余段落。
    - **修剪空白**: 处理句子间的异常空格或换行。
    - **逻辑合并**: 针对特定模式（如连续的三个 `<br>`）进行降级或合并。
    - **特定源处理**: 针对微信等特定来源的广告块、引导关注块进行字符串特征移除。

### Phase 4: Sanitization (Post-pass / 安全级)
- **职责**: 最后关卡，确保输出安全且闭合。
- **动作**: `DOMPurify` 过滤。
- **状态**: 保持现有逻辑。

## 3. 技术设计

### 3.1 核心改动点
在 `cleanHtml` 函数中引入 `refineHtml` 私有函数：

```typescript
export function cleanHtml(container: any, options?: Options): string {
  // 1. Pre-pass (DOM)
  normalizeStructure(container);

  // 2. Main-pass (Conversion)
  const rawHtml = fragments.join('\n');

  // 3. Secondary-pass (Refinement - NEW)
  const refinedHtml = refineHtml(rawHtml);

  // 4. Post-pass (Sanitize)
  return DOMPurify.sanitize(refinedHtml, ...);
}
```

## 4. 任务清单

- [ ] **框架重构**: 在 `utils/html.ts` 中注入 `refineHtml` 处理阶段。
- [ ] **基础规则集**:
    - [ ] 移除各种形式的空行/空段落。
    - [ ] 统一并清理非破折号类别的连续空格。
- [ ] **特定源适配**: 增加对微信公众号文章常见干扰信息的字符串级剔除规则。
- [ ] **性能监控**: 确保正则表达式不会引起 ReDoS（正规表达式拒绝服务攻击），保持 Worker 高效运行。

## 5. 进度

- **状态**: 计划中 (Planned)
- **最近更新**: 2026-04-17 (方案评审通过)
