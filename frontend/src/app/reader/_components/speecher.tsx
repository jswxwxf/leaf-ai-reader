"use client";

import { ChevronLeft, Play, Square, ChevronRight } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useSpeech } from "../_hooks/use-speech";
import { useMediaSession } from "../_hooks/use-media-session";
import { useReaderStore } from "../_store/store";
import { SpeecherSettings } from "./speecher-settings";

/**
 * 语音播放控制组件 (Speecher)
 */
export function Speecher() {
  const { play, step, stop, isPlaying } = useSpeech();
  const { isContentLoading } = useReaderStore(
    useShallow((state) => ({
      isContentLoading: state.isContentLoading,
    }))
  );

  // 使用正式集成的 MediaSession 控制
  const { activateMedia, deactivateMedia } = useMediaSession({
    onPlayPause: () => {
      // 蓝牙按键触发时，根据当前音频状态决定是播还是停
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

  // 包装点击处理函数，实现双重控制
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
    <div className={`flex items-center gap-4 ${isContentLoading ? "opacity-50" : ""}`}>
      <button
        className="btn flex items-center justify-center w-[52px] h-[52px] rounded-full bg-primary/10 border-none hover:bg-primary/20 active:scale-90 transition-all"
        title="上一句"
        onClick={() => step(-1)}
        disabled={isContentLoading}
      >
        <ChevronLeft className="w-6 h-6 text-primary" />
      </button>

      <div className="join bg-primary/10 p-1 rounded-2xl items-center">
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

      <button
        className="btn flex items-center justify-center w-[52px] h-[52px] rounded-full bg-primary/10 border-none hover:bg-primary/20 active:scale-90 transition-all"
        title="下一句"
        onClick={() => step(1)}
        disabled={isContentLoading}
      >
        <ChevronRight className="w-6 h-6 text-primary" />
      </button>
    </div>
  );
}
