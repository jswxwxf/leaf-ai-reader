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


