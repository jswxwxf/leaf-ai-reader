'use client';

import { Speecher } from "./speecher";
import { useSpeech } from "../_hooks/use-speech";
import { useStepGesture } from "../_hooks/use-step-gesture";

/**
 * 阅读器底部控制栏组件
 */
export function Footer() {
  const { play, step, stop, isPlaying } = useSpeech();

  const handleToggle = () => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  };

  const gestureHandlers = useStepGesture({
    onTap: handleToggle,
    onDoubleClick: () => step(1),
    onSwipeLeft: () => step(-1),
    onSwipeRight: () => step(1),
  });

  return (
    <footer
      onPointerDownCapture={(event) => {
        if (event.target !== event.currentTarget) return;
        gestureHandlers.onPointerDownCapture(event);
      }}
      onPointerUpCapture={(event) => {
        if (event.target !== event.currentTarget) return;
        gestureHandlers.onPointerUpCapture(event);
      }}
      onPointerCancelCapture={(event) => {
        if (event.target !== event.currentTarget) return;
        gestureHandlers.onPointerCancelCapture(event);
      }}
      onClickCapture={(event) => {
        if (event.target !== event.currentTarget) return;
        gestureHandlers.onClickCapture(event);
      }}
      className="h-20 bg-base-200 border-t border-base-300 flex flex-none items-center justify-center cursor-pointer touch-pan-y hover:bg-base-300/30 active:bg-base-300/60 transition-all"
      title={isPlaying ? "点击停止" : "点击播放"}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md md:max-w-xl">
        <Speecher />
      </div>
    </footer>
  );
}
