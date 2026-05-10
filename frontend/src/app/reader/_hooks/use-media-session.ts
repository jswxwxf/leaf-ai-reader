"use client";

import { useCallback, useEffect, useRef } from "react";

// 手动切换系统媒体控制。设为 false 后，不注册 MediaSession，也不播放 silent_31s.m4a。
export const ENABLE_READER_MEDIA_SESSION = false;

interface MediaHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * 集成系统级媒体控制方案 (MediaSession)
 * 通过一段隐形循环音频霸占系统音频焦点，从而实现蓝牙/硬件按键对 Web TTS 的控制。
 */
export function useMediaSession({ onPlay, onPause, onNext, onPrev }: MediaHandlers) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // 使用 Ref 保证回调永远是最新的
  const handlers = useRef({ onPlay, onPause, onNext, onPrev });
  useEffect(() => {
    handlers.current = { onPlay, onPause, onNext, onPrev };
  }, [onPlay, onPause, onNext, onPrev]);

  useEffect(() => {
    if (!ENABLE_READER_MEDIA_SESSION || typeof window === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Leaf AI Reader",
      artist: "蓝牙/系统控制模式已激活",
    });

    // 1. 播放/暂停逻辑保持单向映射，避免系统补发 pause/play 时误触发 toggle。
    navigator.mediaSession.setActionHandler("play", () => {
      handlers.current.onPlay();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      handlers.current.onPause();
    });
    navigator.mediaSession.setActionHandler("stop", () => {
      handlers.current.onPause();
    });

    // 2. 上一跳/下一跳 逻辑映射
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      handlers.current.onNext();
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      handlers.current.onPrev();
    });

    return () => {
      audioRef.current?.pause();
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, []);

  /**
   * 激活媒体焦点
   * 必须在用户交互（如点击播放按钮）的同一个同步事件流中调用
   */
  const activateMedia = useCallback(() => {
    if (!ENABLE_READER_MEDIA_SESSION) return;
    if (typeof window === "undefined") return;
    if (!audioRef.current) {
      // 使用 31 秒的实体 m4a 文件，以满足 iOS 的严格音频流检测
      audioRef.current = new Audio("/silent_31s.m4a");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.05; // 需保持微弱声音以维持 OS 焦点
    }
    audioRef.current.play()
      .then(() => {
        navigator.mediaSession.playbackState = "playing";
      })
      .catch(e => console.error("[MediaSession] 激活焦点失败:", e));
  }, []);

  /**
   * 释放媒体焦点
   */
  const deactivateMedia = useCallback(() => {
    if (!ENABLE_READER_MEDIA_SESSION) return;
    if (audioRef.current) {
      audioRef.current.pause();
      navigator.mediaSession.playbackState = "paused";
    }
  }, []);

  return { activateMedia, deactivateMedia };
}
