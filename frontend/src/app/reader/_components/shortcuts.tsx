"use client";

import { useShortCuts } from "../_hooks/use-short-cuts";
import { useSpeech } from "../_hooks/use-speech";

/** 阅读器统一的键盘快捷键入口，只在 Reader 中挂载一次。 */
export function Shortcuts() {
  const { isPlaying, play, stop, step } = useSpeech();

  useShortCuts({ isPlaying, play, stop, step });

  return null;
}
