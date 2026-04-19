import Link from "next/link";
import { ChevronLeft, Play, Square, ChevronRight } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useSpeech } from "../_hooks/use-speech";
import { useMediaSession } from "../_hooks/use-media-session";
import { useReaderStore } from "../_store/store";
import { SpeecherSettings } from "./speecher-settings";
import type { Chapter, BookData } from "@/lib/book";

/**
 * 语音播放控制组件 (Speecher) - 集成章节导航版
 */
export function Speecher() {
  const { play, step, stop, isPlaying } = useSpeech();
  const { isContentLoading, data, path } = useReaderStore(
    useShallow((state) => ({
      isContentLoading: state.isContentLoading,
      data: state.data,
      path: state.path,
    }))
  );

  // 章节切换逻辑计算
  const bookData = data as BookData;
  const isBookMode = !!bookData?.chapters;
  let prevChapter: Chapter | undefined;
  let nextChapter: Chapter | undefined;

  if (isBookMode && path) {
    const allChapters = bookData.flattenChapters || [];
    const currentIndex = allChapters.findIndex(c => c.path === path);
    if (currentIndex !== -1) {
      prevChapter = allChapters[currentIndex - 1];
      nextChapter = allChapters[currentIndex + 1];
    }
  }

  // 使用正式集成的 MediaSession 控制
  const { activateMedia, deactivateMedia } = useMediaSession({
    onPlayPause: () => {
      if (isPlaying) {
        stop();
        deactivateMedia();
      } else {
        play();
        activateMedia();
      }
    },
    onNext: () => step(1),
    onPrev: () => step(-1),
  });

  const handleToggle = () => {
    if (isPlaying) {
      stop();
      deactivateMedia();
    } else {
      play();
      activateMedia();
    }
  };

  return (
    <div className={`flex items-center justify-between w-full max-w-md md:max-w-xl mx-auto px-4 ${isContentLoading ? "opacity-30 pointer-events-none" : ""}`}>
      {/* 1. 左侧：上一章 */}
      {isBookMode ? (
        <div className="flex-1 basis-0 flex justify-start">
          <Link
            href={prevChapter ? `/reader?book_id=${bookData.id}&path=${encodeURIComponent(prevChapter.path)}` : "#"}
            className={`text-xs font-semibold whitespace-nowrap relative inline-flex items-center ${prevChapter ? "opacity-90" : "opacity-20 pointer-events-none"
              }`}
          >
            <span
              className="absolute inset-x-[-12px] inset-y-[-12px] transition-all active:bg-primary/10 active:scale-90"
              aria-hidden="true"
            />
            &lt; 上一章
          </Link>
        </div>
      ) : (
        <div 
          className="flex-1 basis-0 cursor-pointer" 
          onClick={handleToggle}
          title={isPlaying ? "停止朗读" : "开始朗读"}
        />
      )}

      {/* 2. 中间：播放核心控制台 */}
      <div className="flex-none flex items-center gap-1 sm:gap-3 justify-center">
        {/* 上一句按钮 */}
        <button
          className="btn flex items-center justify-center w-[52px] h-[52px] rounded-full bg-primary/10 border-none hover:bg-primary/20 active:scale-95 transition-all flex-none"
          title="上一句"
          onClick={() => step(-1)}
          disabled={isContentLoading}
        >
          <ChevronLeft className="w-6 h-6 text-primary" />
        </button>

        <div className="join bg-primary/10 p-1 rounded-2xl items-center border border-primary/5 flex-none">
          <button
            className="btn btn-ghost h-[52px] join-item rounded-l-2xl px-5 border-none hover:bg-primary/10 active:scale-95 transition-all text-primary"
            title={isPlaying ? "停止朗读" : "开始朗读"}
            onClick={handleToggle}
            disabled={isContentLoading}
          >
            {isPlaying ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </button>
          <div className="w-[1px] h-8 bg-primary/20" />
          <div className="h-[52px] join-item rounded-r-2xl border-none flex items-center">
            <SpeecherSettings />
          </div>
        </div>

        {/* 下一句按钮 */}
        <button
          className="btn flex items-center justify-center w-[52px] h-[52px] rounded-full bg-primary/10 border-none hover:bg-primary/20 active:scale-95 transition-all flex-none"
          title="下一句"
          onClick={() => step(1)}
          disabled={isContentLoading}
        >
          <ChevronRight className="w-6 h-6 text-primary" />
        </button>
      </div>

      {/* 3. 右侧：下一章 */}
      {isBookMode ? (
        <div className="flex-1 basis-0 flex justify-end">
          <Link
            href={nextChapter ? `/reader?book_id=${bookData.id}&path=${encodeURIComponent(nextChapter.path)}` : "#"}
            className={`text-xs font-semibold whitespace-nowrap relative inline-flex items-center ${nextChapter ? "opacity-90" : "opacity-20 pointer-events-none"
              }`}
          >
            <span
              className="absolute inset-x-[-12px] inset-y-[-12px] transition-all active:bg-primary/10 active:scale-90"
              aria-hidden="true"
            />
            下一章 &gt;
          </Link>
        </div>
      ) : (
        <div 
          className="flex-1 basis-0 cursor-pointer" 
          onClick={handleToggle}
          title={isPlaying ? "停止朗读" : "开始朗读"}
        />
      )}
    </div>
  );
}
