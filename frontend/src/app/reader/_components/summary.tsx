"use client";

import { Star } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "../_store/store";

/**
 * 重点列表组件 (AI 核心摘要)
 */
export function Summary() {
  const {
    summaries,
    activeSentenceId,
    jumpToSentence,
    data
  } = useReaderStore(
    useShallow((state) => ({
      summaries: state.summaries,
      activeSentenceId: state.activeSentenceId,
      jumpToSentence: state.jumpToSentence,
      data: state.data,
    }))
  );

  return (
    <aside className="w-80 border-l border-base-300 bg-base-100 hidden lg:flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-4 flex-none border-b border-base-200">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> AI 核心摘要
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {summaries.length > 0 ? (
          summaries.map((item, index) => {
            const isActive = activeSentenceId === item.start_sId;
            return (
              <div
                key={index}
                onClick={() => jumpToSentence(item.start_sId)}
                className={`card cursor-pointer transition-all duration-300 border ${isActive
                    ? "bg-primary/10 border-primary shadow-md translate-x-1"
                    : "bg-base-200 border-base-300/50 hover:border-base-300 hover:bg-base-200/80"
                  }`}
              >
                <div className="p-3">
                  <p className={`text-sm leading-relaxed transition-colors ${isActive ? "text-primary font-medium" : "opacity-80 font-normal"
                    }`}>
                    {item.summary}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-10 text-center opacity-40 text-sm">
            {data?.status === 'ready' ? '暂无核心摘要' : '摘要生成中...'}
          </div>
        )}
      </div>
    </aside>
  );
}
