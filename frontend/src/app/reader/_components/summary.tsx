"use client";

import { Star, RefreshCw, Volume2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore, type AISummary } from "../_store/store";
import { useReader } from "../_hooks/use-reader";
import { useSummaryHighlight } from "../_hooks/use-summary-highlight";
import { useSpeech } from "../_hooks/use-speech";
import { useDoubleClick } from "../_hooks/use-double-click";
import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/request";
import { SpeechBox, type SpeechBoxHandle } from "./speech-box";

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
      className={`card w-full snap-center cursor-pointer transition-all duration-300 border ${isActive
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
  const { play, step, stop, isPlaying } = useSpeech();
  const highlightCss = useSummaryHighlight(summaries);
  const speechBoxRefs = useRef<Array<SpeechBoxHandle | null>>([]);

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  };

  const handleClick = useDoubleClick({
    disabled: isContentLoading,
    onSingleClick: handleToggle,
    onDoubleClick: () => step(1),
  });

  const handleReadSummaries = async () => {
    for (const speechBoxRef of speechBoxRefs.current) {
      await speechBoxRef?.speak();
    }
  };

  return (
    <aside className="flex flex-col w-full h-auto border-b order-first overflow-hidden shrink-0 border-base-300 bg-base-100 compact:w-48 md:w-80 compact:h-full compact:border-l compact:border-b-0 compact:order-0">
      <div className="hidden compact:flex p-4 flex-none border-b border-base-200 items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> 摘要
        </h2>
        {!isContentLoading && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); void handleReadSummaries(); }}
              disabled={isSummarizing}
              className="btn btn-ghost btn-xs btn-circle"
              title="朗读摘要"
            >
              {!isSummarizing && <Volume2 className="w-4 h-4 opacity-60" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleSummarize(); }}
              disabled={isSummarizing}
              className={`btn btn-ghost btn-xs btn-circle ${isSummarizing ? 'loading' : ''}`}
              title="生成摘要"
            >
              {!isSummarizing && <RefreshCw className="w-3 h-3 opacity-60" />}
            </button>
          </div>
        )}
      </div>
      <div className="contents compact:flex compact:flex-1 compact:min-h-0 compact:flex-col">
        <div
          className="flex-1 flex flex-row compact:min-h-0 compact:flex-col overflow-x-auto compact:overflow-x-hidden compact:overflow-y-auto p-3 space-x-3 compact:space-x-0 space-y-0 compact:space-y-3 custom-scrollbar snap-x snap-mandatory"
          onClickCapture={(event) => {
            // 补充 padding / 间隔区域的点击。
            if (event.target !== event.currentTarget) return;
            handleClick(event);
          }}
        >
          {summaries.length > 0 ? (
            summaries.map((item, index) => {
              const isActive = summarySentenceId ? summarySentenceId === item.start_sId : index === 0;
              return (
                <div key={index} className="flex-none w-[25vw] h-full compact:w-full compact:h-auto [&>div]:h-full compact:[&>div]:h-auto [&>div>div]:h-full compact:[&>div>div]:h-auto">
                  <SpeechBox ref={(node) => { speechBoxRefs.current[index] = node; }}>
                    <SummaryItem
                      item={item}
                      isActive={isActive}
                      onClick={() => jumpToSentence(item.start_sId)}
                    />
                  </SpeechBox>
                </div>
              );
            })
          ) : (
            <div
              className="py-10 text-center w-full space-y-4 px-6"
              onClickCapture={(event) => {
                if (event.target !== event.currentTarget) return;
                handleClick(event);
              }}
            >
              <p className="opacity-40 text-sm hidden sm:block">
                {isSummarizing || data?.status !== 'ready'
                  ? '摘要生成中...'
                  : '暂无摘要'}
              </p>
              {!isContentLoading && data?.status === 'ready' && (
                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className={`btn btn-primary shadow-lg ${isSummarizing ? 'loading' : 'btn-md w-full compact:btn-sm'}`}
                >
                  {isSummarizing ? '正在生成' : '生成摘要'}
                </button>
              )}
            </div>
          )}
          <div
            className="hidden compact:block compact:flex-1 compact:cursor-pointer"
            onClickCapture={handleClick}
            title={isPlaying ? "点击停止" : "点击播放"}
          />
        </div>
        {/* 底部留白区域，点击可触发播放/暂停，仅在触屏设备的 compact 以上垂直布局时有效 */}
        <div
          className="hidden h-32 shrink-0 cursor-pointer pointer-coarse:compact:block"
          onClickCapture={handleClick}
          title={isPlaying ? "点击停止" : "点击播放"}
        />
      </div>
      {highlightCss && <style dangerouslySetInnerHTML={{ __html: highlightCss }} />}
    </aside>
  );
}
