"use client";

import { Star } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore, type AISummary } from "../_store/store";
import { useReader } from "../_hooks/use-reader";
import { useEffect, useRef } from "react";

/**
 * 单个摘要项组件，负责处理自身的自动滚动逻辑
 */
function SummaryItem({
  item,
  isActive,
  onClick
}: {
  item: AISummary,
  isActive: boolean,
  onClick: () => void
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [isActive]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`card flex-none w-[25vw] lg:w-full snap-center cursor-pointer transition-all duration-300 border ${isActive
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
}

/**
 * 重点列表组件 (AI 核心摘要)
 */
export function Summary() {
  const {
    summaries,
    summarySentenceId,
    data
  } = useReaderStore(
    useShallow((state) => ({
      summaries: state.summaries,
      summarySentenceId: state.summarySentenceId,
      data: state.data,
    }))
  );
  const { jumpToSentence } = useReader();

  return (
    <aside className="flex flex-col w-full h-auto border-b order-first overflow-hidden shrink-0 border-base-300 bg-base-100 lg:w-80 lg:h-full lg:border-l lg:border-b-0 lg:order-0">
      <div className="hidden lg:block p-4 flex-none border-b border-base-200">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> AI 核心摘要
        </h2>
      </div>
      <div className="flex-1 flex flex-row lg:flex-col overflow-x-auto lg:overflow-y-auto p-3 space-x-3 lg:space-x-0 space-y-0 lg:space-y-3 custom-scrollbar snap-x snap-mandatory">
        {summaries.length > 0 ? (
          summaries.map((item, index) => {
            const isActive = summarySentenceId ? summarySentenceId === item.start_sId : index === 0;
            return (
              <SummaryItem
                key={index}
                item={item}
                isActive={isActive}
                onClick={() => jumpToSentence(item.start_sId)}
              />
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
