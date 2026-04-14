"use client";

import { useEffect, useRef } from "react";

interface MediaHandlers {
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * 集成系统级媒体控制方案 (MediaSession)
 * 通过一段隐形循环音频霸占系统音频焦点，从而实现蓝牙/硬件按键对 Web TTS 的控制。
 */
export function useMediaSession({ onPlayPause, onNext, onPrev }: MediaHandlers) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // 使用 Ref 保证回调永远是最新的
  const handlers = useRef({ onPlayPause, onNext, onPrev });
  useEffect(() => {
    handlers.current = { onPlayPause, onNext, onPrev };
  }, [onPlayPause, onNext, onPrev]);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Leaf AI Reader",
      artist: "蓝牙/系统控制模式已激活",
    });

    // 1. 播放/暂停 逻辑映射
    const handleToggle = () => {
      handlers.current.onPlayPause();
    };
    navigator.mediaSession.setActionHandler("play", handleToggle);
    navigator.mediaSession.setActionHandler("pause", handleToggle);

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
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, []);

  /**
   * 激活媒体焦点
   * 必须在用户交互（如点击播放按钮）的同一个同步事件流中调用
   */
  const activateMedia = () => {
    if (typeof window === "undefined") return;
    if (!audioRef.current) {
      // 使用一段符合标准、完全静音的 WAV Base64
      audioRef.current = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAE=");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.05; // 需保持微弱声音以维持 OS 焦点
    }
    audioRef.current.play()
      .then(() => {
        navigator.mediaSession.playbackState = "playing";
      })
      .catch(e => console.error("[MediaSession] 激活焦点失败:", e));
  };

  /**
   * 释放媒体焦点
   */
  const deactivateMedia = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      navigator.mediaSession.playbackState = "paused";
    }
  };

  return { activateMedia, deactivateMedia };
}
