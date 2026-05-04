"use client";

import React, { useEffect, useRef, useState } from "react";

type ToastType = "info" | "success" | "warning" | "error";
type ToastVertical = "top" | "middle" | "bottom";
type ToastHorizontal = "start" | "center" | "end";

interface ToastConfig {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  vertical: ToastVertical;
  horizontal: ToastHorizontal;
}

type ToastOptions = Partial<Omit<ToastConfig, "id">> & {
  message: string;
};

const DEFAULT_TOAST: Omit<ToastConfig, "id" | "message"> = {
  type: "info",
  duration: 3500,
  vertical: "bottom",
  horizontal: "end",
};

const alertClassByType: Record<ToastType, string> = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error",
};

// GlobalToasts 还没挂载时，showToast 可能已经被 request.ts 调用。
// 这里先把 toast 暂存起来，等组件挂载后一次性灌进 React state。
let pendingToasts: ToastConfig[] = [];

// 这是和 global-modals.tsx 类似的“命令式入口”桥接：
// showToast 可以在 React 组件外调用，真正的 setState 会在 GlobalToasts 挂载后接管。
let setToastItems: React.Dispatch<React.SetStateAction<ToastConfig[]>> = (updater) => {
  const nextToast = typeof updater === "function" ? updater(pendingToasts) : updater;
  pendingToasts = nextToast;
};

export function showToast(options: ToastOptions) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const toast: ToastConfig = {
    ...DEFAULT_TOAST,
    ...options,
    id,
  };

  setToastItems((items) => [...items, toast]);
  return id;
}

export function GlobalToasts() {
  const [toasts, _setToastItems] = useState<ToastConfig[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // 组件挂载后，把模块级 setter 指向真实的 React setState。
  // 如果挂载前已经积累了 pending toast，也在这里补显示出来。
  useEffect(() => {
    setToastItems = _setToastItems;

    if (pendingToasts.length > 0) {
      _setToastItems(pendingToasts);
      pendingToasts = [];
    }
  }, [_setToastItems]);

  // 为每条 toast 启动一个自动移除计时器。
  // duration <= 0 时不自动关闭，方便以后做需要手动关闭的提示。
  useEffect(() => {
    const activeIds = new Set(toasts.map((toast) => toast.id));

    // state 里已经不存在的 toast，对应计时器也清掉，避免泄漏。
    for (const [id, timer] of timersRef.current) {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }

    toasts.forEach((toast) => {
      if (toast.duration <= 0 || timersRef.current.has(toast.id)) return;

      const timer = setTimeout(() => {
        _setToastItems((items) => items.filter((item) => item.id !== toast.id));
      }, toast.duration);

      timersRef.current.set(toast.id, timer);
    });
  }, [toasts]);

  // 页面卸载时清理所有计时器。
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // daisyUI 的 toast 容器本身负责一个固定位置。
  // 所以不同位置的 toast 要分组渲染成多个容器。
  const groupedToasts = toasts.reduce<Record<string, ToastConfig[]>>((groups, toast) => {
    const key = `${toast.vertical}-${toast.horizontal}`;
    groups[key] = [...(groups[key] ?? []), toast];
    return groups;
  }, {});

  return (
    <>
      {Object.entries(groupedToasts).map(([position, items]) => {
        const [vertical, horizontal] = position.split("-");

        return (
          <div
            key={position}
            className={`toast toast-${vertical} toast-${horizontal} z-50 pointer-events-none`}
          >
            {items.map((toast) => (
              <div
                key={toast.id}
                className={`alert ${alertClassByType[toast.type]} pointer-events-auto max-w-sm rounded-md shadow-lg`}
              >
                <span className="text-sm leading-relaxed">{toast.message}</span>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
