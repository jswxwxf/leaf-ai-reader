"use client";

import { Star, RefreshCw } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore, type AISummary } from "../_store/store";
import { useReader } from "../_hooks/use-reader";
import { useSummaryHighlight } from "../_hooks/use-summary-highlight";
import { useSpeech } from "../_hooks/use-speech";
import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/request";

/**
 * 封装摘要重刷逻辑的 Hook
 */
function useSummarize() {
  const { mode, article_id, book_id, path, setSummaries } = useReaderStore(
    useShallow((state) => ({
      mode: state.mode,
      article_id: state.article_id,
      book_id: state.book_id,
      path: state.path,
      setSummaries: state.setSummaries,
    }))
  );

  const [isSummarizing, setIsSummarizing] = useState(false);

  const handleSummarize = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    try {
      const result = await request<{ success: boolean; summaries: AISummary[] }>('/api/reader/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          id: mode === 'book' ? book_id : article_id,
          path: path
        })
      });

      if (result.summaries) {
        setSummaries(result.summaries);
      }
    } catch (e) {
      // 错误已由 request.ts 内部处理
    } finally {
      setIsSummarizing(false);
    }
  };

  return { isSummarizing, handleSummarize };
}

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
      className={`card flex-none w-[25vw] md:w-full snap-center cursor-pointer transition-all duration-300 border ${isActive
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
    data,
    isContentLoading,
  } = useReaderStore(
    useShallow((state) => ({
      summaries: state.summaries,
      summarySentenceId: state.summarySentenceId,
      data: state.data,
      isContentLoading: state.isContentLoading,
    }))
  );
  const { isSummarizing, handleSummarize } = useSummarize();
  const { jumpToSentence } = useReader();
  const { play, stop, isPlaying } = useSpeech();
  const highlightCss = useSummaryHighlight(summaries);

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  };

  return (
    <aside className="flex flex-col w-full h-auto border-b order-first overflow-hidden shrink-0 border-base-300 bg-base-100 md:w-80 md:h-full md:border-l md:border-b-0 md:order-0">
      <div className="hidden md:flex p-4 flex-none border-b border-base-200 items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> 摘要
        </h2>
        {!isContentLoading && (
          <button
            onClick={(e) => { e.stopPropagation(); handleSummarize(); }}
            disabled={isSummarizing}
            className={`btn btn-ghost btn-xs btn-circle ${isSummarizing ? 'loading' : ''}`}
            title="生成摘要"
          >
            {!isSummarizing && <RefreshCw className="w-3 h-3 opacity-60" />}
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto p-3 space-x-3 md:space-x-0 space-y-0 md:space-y-3 custom-scrollbar snap-x snap-mandatory">
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
          <div className="py-10 text-center w-full space-y-4 px-6">
            <p className="opacity-40 text-sm hidden sm:block">
              {isSummarizing || data?.status !== 'ready'
                ? '摘要生成中...'
                : '暂无摘要'}
            </p>
            {!isContentLoading && data?.status === 'ready' && (
              <button
                onClick={handleSummarize}
                disabled={isSummarizing}
                className={`btn btn-primary shadow-lg ${isSummarizing ? 'loading' : 'btn-md w-full md:btn-sm'}`}
              >
                {isSummarizing ? '正在生成' : '生成摘要'}
              </button>
            )}
          </div>
        )}
        {/* 底部留白区域，点击可触发播放/暂停，仅在 md 以上垂直布局时有效 */}
        <div
          className="flex-1 hidden md:block cursor-pointer"
          onClick={handleToggle}
          title={isPlaying ? "点击停止" : "点击播放"}
        />
      </div>
      {highlightCss && <style dangerouslySetInnerHTML={{ __html: highlightCss }} />}
    </aside>
  );
}
