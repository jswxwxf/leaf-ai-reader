import { type ArticleData } from "@/lib/article";
import { type BookData } from "@/lib/book";

/**
 * AI 摘要条目接口
 */
export interface AISummary {
  summary: string;
  start_sId: string;
}

/**
 * 统一解析摘要字符串的工具函数
 */
export function parseSummaries(data: ArticleData | BookData | null): AISummary[] {
  let summaries: AISummary[] = [];
  const summaryRaw = (data as ArticleData)?.summary;
  if (summaryRaw) {
    try {
      const parsed = JSON.parse(summaryRaw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.summaries)) {
        summaries = parsed.summaries;
      }
    } catch (e) {
      summaries = summaryRaw.split('\n')
        .filter(p => p.trim())
        .map((p, i) => ({ summary: p, start_sId: `s-${i}` }));
    }
  }
  return summaries;
}

/**
 * 句子跳转 Action 的实现逻辑 (置于外部以保持 Store 结构清晰)
 */
export const jumpToSentence = (set: any, sId: string) => {
  set({ isManualScrolling: true, activeSentenceId: sId });

  const el = document.getElementById(sId);
  const unlock = () => set({ isManualScrolling: false });

  // 1. 元素不存在
  if (!el) {
    unlock();
    return;
  }

  // 2. 执行跳转
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const container = el.closest('section');
  const hasScrollEnd = 'onscrollend' in window || (window as any).onscrollend !== undefined;

  // 3. 兜底处理
  if (!container || !hasScrollEnd) {
    setTimeout(unlock, 1000);
    return;
  }

  // 4. 事件监听流程
  const handleScrollEnd = () => {
    unlock();
    container.removeEventListener('scrollend', handleScrollEnd);
  };
  container.addEventListener('scrollend', handleScrollEnd);
};
