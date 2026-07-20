import { useCallback, useEffect } from "react";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

const IDLE_RELEASE_DELAY_MS = 5 * 60 * 1000;

let wakeLock: WakeLockSentinelLike | null = null;
let wakeLockRequest: Promise<void> | null = null;
let wakeLockVersion = 0;

/**
 * 屏幕常亮 (Screen Wake Lock) 管理 Hook
 * @param enabled 是否处于应当保持唤醒的状态（如正在播放）
 */
export function useWakeLock(enabled: boolean) {
  // 申请 Wake Lock
  const requestWakeLock = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("wakeLock" in navigator) ||
      wakeLock ||
      wakeLockRequest
    )
      return;

    const requestVersion = wakeLockVersion;
    wakeLockRequest = (async () => {
      try {
        const nextWakeLock = await (navigator as any).wakeLock.request("screen") as WakeLockSentinelLike;
        if (requestVersion !== wakeLockVersion) {
          await nextWakeLock.release();
          return;
        }

        wakeLock = nextWakeLock;
        nextWakeLock.addEventListener("release", () => {
          if (wakeLock === nextWakeLock) {
            wakeLock = null;
          }
        });
      } catch (err) {
        console.warn("[WakeLock] 申请屏幕常亮失败:", err);
      } finally {
        wakeLockRequest = null;
      }
    })();

    await wakeLockRequest;
  }, []);

  // 释放 Wake Lock
  const releaseWakeLock = useCallback(async () => {
    wakeLockVersion += 1;
    const currentWakeLock = wakeLock;
    if (!currentWakeLock) return;

    wakeLock = null;
    await currentWakeLock.release();
  }, []);

  // 朗读暂停后保留一段时间，超时仍未恢复则允许屏幕休眠。
  useEffect(() => {
    if (enabled) return;

    const timer = window.setTimeout(() => {
      void releaseWakeLock();
    }, IDLE_RELEASE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, releaseWakeLock]);

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
  }, [enabled, requestWakeLock]);

  // 仅在组件销毁时做最终清理
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return { requestWakeLock, releaseWakeLock };
}
