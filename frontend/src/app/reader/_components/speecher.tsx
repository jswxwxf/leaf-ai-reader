"use client";

import { ChevronLeft, Play, Square, ChevronRight } from "lucide-react";
import { useSpeech } from "../_hooks/use-speech";

/**
 * 语音播放控制组件 (Speecher)
 */
export function Speecher() {
  const { play, step, stop, isPlaying } = useSpeech();

  return (
    <div className="flex items-center gap-4">
      <button
        className="btn btn-circle bg-primary/10 border-none hover:bg-primary/20 active:scale-90 transition-all"
        title="上一句"
        onClick={() => step(-1)}
      >
        <ChevronLeft className="w-6 h-6 text-primary" />
      </button>

      <button
        className="btn btn-circle btn-primary btn-lg shadow-lg active:scale-95 transition-all"
        title={isPlaying ? "停止朗读" : "开始朗读"}
        onClick={isPlaying ? stop : play}
      >
        {isPlaying ? (
          <Square className="w-6 h-6 fill-current" />
        ) : (
          <Play className="w-6 h-6 fill-current" />
        )}
      </button>

      <button
        className="btn btn-circle bg-primary/10 border-none hover:bg-primary/20 active:scale-90 transition-all"
        title="下一句"
        onClick={() => step(1)}
      >
        <ChevronRight className="w-6 h-6 text-primary" />
      </button>
    </div>
  );
}
