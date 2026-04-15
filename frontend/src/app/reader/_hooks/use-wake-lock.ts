import { useEffect, useRef } from "react";

/**
 * 屏幕常亮 (Screen Wake Lock) 管理 Hook
 * @param enabled 是否处于应当保持唤醒的状态（如正在播放）
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<any>(null);

  // 申请 Wake Lock
  const requestWakeLock = async () => {
    if (
      typeof window === "undefined" ||
      !("wakeLock" in navigator) ||
      wakeLockRef.current
    )
      return;
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
    } catch (err) {
      // 申请失败通常不应阻塞核心业务
    }
  };

  // 释放 Wake Lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // 处理页面可见性变化，确保切回页面后恢复锁
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && enabled) {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // 注意：这里不在 enabled 变化时立即释放，而是组件销毁时释放，
      // 以符合用户“朗读开始后持续常亮”的简化要求。
    };
  }, [enabled]);

  // 仅在组件销毁时做最终清理
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, []);

  return { requestWakeLock, releaseWakeLock };
}
