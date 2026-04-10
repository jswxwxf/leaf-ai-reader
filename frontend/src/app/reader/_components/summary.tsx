"use client";

import { Star } from "lucide-react";
import { useReaderStore } from "../_store/store";
import { type ArticleData } from "@/lib/article";

/**
 * 重点列表组件 (AI 核心摘要)
 */
export function Summary() {
  const data = useReaderStore((state) => state.data);
  
  // 仅文章模式下显示摘要
  const summaryRaw = (data as ArticleData)?.summary;
  
  let summaryPoints: string[] = [];
  if (summaryRaw) {
    try {
      const parsed = JSON.parse(summaryRaw);
      // 处理 {"summaries": [{"summary": "...", ...}, ...]} 格式
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.summaries)) {
        summaryPoints = parsed.summaries.map((s: any) => s.summary || "");
      } 
      // 处理直接的数组格式
      else if (Array.isArray(parsed)) {
        summaryPoints = parsed;
      } else {
        summaryPoints = [summaryRaw];
      }
    } catch (e) {
      // 如果不是 JSON，则按换行分割或直接显示
      summaryPoints = summaryRaw.split('\n').filter(p => p.trim());
    }
  }

  return (
    <aside className="w-80 border-l border-base-300 bg-base-100 hidden lg:flex flex-col h-full overflow-hidden">
      <div className="p-4 flex-none border-b border-base-200">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> AI 核心摘要
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {summaryPoints.length > 0 ? (
          summaryPoints.map((point, index) => (
            <div 
              key={index} 
              className="card bg-base-200 shadow-sm border border-base-300/50"
            >
              <div className="p-3">
                <p className="text-sm opacity-80 leading-relaxed">
                  {point}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center opacity-40 text-sm">
            {data?.status === 'ready' ? '暂无核心摘要' : '摘要生成中...'}
          </div>
        )}
      </div>
    </aside>
  );
}
