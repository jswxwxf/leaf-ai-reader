'use client';

import { Speecher } from "./speecher";
import { useSpeech } from "../_hooks/use-speech";
import { useDoubleClick } from "../_hooks/use-double-click";

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

  const handleClick = useDoubleClick({
    onSingleClick: handleToggle,
    onDoubleClick: () => step(1),
  });

  return (
    <footer
      onClick={handleClick}
      className="h-20 bg-base-200 border-t border-base-300 flex flex-none items-center justify-center cursor-pointer hover:bg-base-300/30 active:bg-base-300/60 transition-all"
      title={isPlaying ? "点击停止" : "点击播放"}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md md:max-w-xl">
        <Speecher />
      </div>
    </footer>
  );
}
