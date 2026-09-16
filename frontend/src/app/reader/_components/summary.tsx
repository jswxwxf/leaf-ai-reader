"use client";

import { Star, Volume2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore, type AISummary } from "../_store/store";
import { useReader } from "../_hooks/use-reader";
import { useSummaryHighlight } from "../_hooks/use-summary-highlight";
import { configureSpeech, sanitizeSpeechText, useSpeech } from "../_hooks/use-speech";
import { useSoundEffect } from "../_hooks/use-sound-effect";
import { useStepGesture } from "../_hooks/use-step-gesture";
import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/request";
import { SummaryItem } from "./summary-item";

/**
 * 封装摘要重刷逻辑的 Hook
 */
function useSummarize() {
  const { prepare, play } = useSoundEffect({ sound: "success" });
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
    // 在按钮点击时解锁音频，等异步请求成功后才可以可靠地播放提示音。
    prepare();
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
        play();
      }
    } catch {
      // 错误已由 request.ts 内部处理
      play("error");
    } finally {
      setIsSummarizing(false);
    }
  };

  return { isSummarizing, handleSummarize };
}

const speakSummaries = (text: string) => new Promise<void>((resolve) => {
  const trimmedText = sanitizeSpeechText(text).trim();
  if (!trimmedText || typeof window === 'undefined' || !window.speechSynthesis) {
    resolve();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(trimmedText);
  configureSpeech(utterance);
  utterance.onend = () => resolve();
  utterance.onerror = () => resolve();
  window.speechSynthesis.speak(utterance);
});

interface UseReadSummariesOptions {
  summaries: AISummary[];
  path: string | null;
  disabled: boolean;
}

/**
 * 管理摘要朗读及章节切换时的清理。
 */
function useReadSummaries({ summaries, path, disabled }: UseReadSummariesOptions) {
  const [isReading, setIsReading] = useState(false);
  // 立即上锁，避免 React 状态更新前的快速连点重复启动朗读。
  const isReadingRef = useRef(false);
  // 作废旧朗读队列，避免 cancel 后旧 Promise 恢复并继续读下一条。
  const sessionRef = useRef(0);
  const readingPathRef = useRef(path);

  useEffect(() => {
    if (readingPathRef.current === path) return;

    readingPathRef.current = path;
    if (!isReadingRef.current) return;

    // 正文区域会统一取消浏览器语音；这里仅作废摘要的异步循环。
    sessionRef.current += 1;
    isReadingRef.current = false;
    setIsReading(false);
  }, [path]);

  const readSummaries = async () => {
    // 不可用、没有摘要或当前仍在朗读时，忽略本次点击。
    if (disabled || summaries.length === 0 || isReadingRef.current) return;

    // 为本轮朗读分配唯一标识，章节切换后可借此让旧队列退出。
    const sessionId = ++sessionRef.current;
    isReadingRef.current = true;
    setIsReading(true);

    try {
      // 清理可能残留的浏览器语音队列，再从当前摘要开始朗读。
      window.speechSynthesis?.cancel();

      for (const summary of summaries) {
        // 如果章节已切换，本轮会话已失效，不再开始下一条摘要。
        if (sessionId !== sessionRef.current) return;
        await speakSummaries(summary.summary);
        // cancel 后 await 仍可能恢复；再次检查以避免继续读后续摘要。
        if (sessionId !== sessionRef.current) return;
      }
    } finally {
      // 旧会话不应重置新会话的朗读状态。
      if (sessionId !== sessionRef.current) return;

      // 所有摘要朗读完成，解除点击锁定。
      isReadingRef.current = false;
      setIsReading(false);
    }
  };

  return {
    canReadSummaries: !disabled && !isReading && summaries.length > 0,
    readSummaries,
  };
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
    path,
  } = useReaderStore(
    useShallow((state) => ({
      summaries: state.summaries,
      summarySentenceId: state.summarySentenceId,
      data: state.data,
      isContentLoading: state.isContentLoading,
      path: state.path,
    }))
  );
  const { isSummarizing, handleSummarize } = useSummarize();
  const { jumpToSentence } = useReader();
  const { play, step, stop, isPlaying } = useSpeech();
  const highlightCss = useSummaryHighlight(summaries);
  const { canReadSummaries, readSummaries } = useReadSummaries({
    summaries,
    path,
    disabled: isContentLoading || isSummarizing,
  });

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  };

  const gestureHandlers = useStepGesture({
    disabled: isContentLoading,
    onTap: handleToggle,
    onDoubleClick: () => step(1),
    onSwipeLeft: () => step(-1),
    onSwipeRight: () => step(1),
  });

  return (
    <aside className="flex flex-col w-full h-auto border-b order-first overflow-hidden shrink-0 border-base-300 bg-base-100 compact:w-48 md:w-80 compact:h-full compact:border-l compact:border-b-0 compact:order-0">
      <div
        className={`hidden compact:flex p-4 flex-none border-b border-base-200 items-center justify-between ${canReadSummaries ? 'cursor-pointer' : ''}`}
        onClick={() => void readSummaries()}
        title="朗读摘要"
      >
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> 摘要
        </h2>
        {!isContentLoading && (
          <div className="flex items-center gap-1">
            <span className="btn btn-ghost btn-xs btn-circle" aria-hidden="true">
              {!isSummarizing && <Volume2 className="w-4 h-4 opacity-60" />}
            </span>
            {/* <button
              onClick={(e) => { e.stopPropagation(); handleSummarize(); }}
              disabled={isSummarizing}
              className={`btn btn-ghost btn-xs btn-circle ${isSummarizing ? 'loading' : ''}`}
              title="生成摘要"
            >
              {!isSummarizing && <RefreshCw className="w-3 h-3 opacity-60" />}
            </button> */}
          </div>
        )}
      </div>
      <div className="contents compact:flex compact:flex-1 compact:min-h-0 compact:flex-col">
        <div
          className="flex-1 flex flex-row compact:min-h-0 compact:flex-col overflow-x-auto compact:overflow-x-hidden compact:overflow-y-auto p-3 space-x-3 compact:space-x-0 space-y-0 compact:space-y-3 custom-scrollbar snap-x snap-mandatory"
          onClickCapture={(event) => {
            // 补充 padding / 间隔区域的点击。
            if (event.target !== event.currentTarget) return;
            gestureHandlers.onClickCapture(event);
          }}
        >
          {summaries.length > 0 ? (
            summaries.map((item, index) => {
              const isActive = summarySentenceId ? summarySentenceId === item.start_sId : index === 0;
              return (
                <div key={index} className="flex-none w-[25vw] h-full compact:w-full compact:h-auto [&>div]:h-full compact:[&>div]:h-auto [&>div>div]:h-full compact:[&>div>div]:h-auto">
                  <SummaryItem
                    item={item}
                    isActive={isActive}
                    onClick={() => jumpToSentence(item.start_sId)}
                    onDelete={() => {}}
                  />
                </div>
              );
            })
          ) : (
            <div
              className="py-10 text-center w-full space-y-4 px-6"
              onClickCapture={(event) => {
                if (event.target !== event.currentTarget) return;
                gestureHandlers.onClickCapture(event);
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
            {...gestureHandlers}
            className="hidden select-none touch-pan-y compact:block compact:flex-1 compact:cursor-pointer"
            title={isPlaying ? "点击停止" : "点击播放"}
          />
        </div>
        {/* 底部留白区域，点击可触发播放/暂停，仅在触屏设备的 compact 以上垂直布局时有效 */}
        <div
          {...gestureHandlers}
          className="hidden h-76 shrink-0 cursor-pointer select-none touch-pan-y pointer-coarse:compact:block"
          title={isPlaying ? "点击停止" : "点击播放"}
        />
      </div>
      {highlightCss && <style dangerouslySetInnerHTML={{ __html: highlightCss }} />}
    </aside>
  );
}
