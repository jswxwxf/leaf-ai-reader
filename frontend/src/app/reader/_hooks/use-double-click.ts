import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";

interface Options {
  delay?: number;
  disabled?: boolean;
  onSingleClick: () => void;
  onDoubleClick: () => void;
}

/**
 * 将同一个元素上的单击和双击做互斥仲裁。
 *
 * 浏览器触发 double click 前通常已经派发了两次 click，所以不能只在
 * onDoubleClick 里处理双击；否则单击逻辑会先执行。这个 hook 会先拦截
 * click，短暂等待第二次 click：没有第二次才执行单击，有第二次则执行双击。
 */
export function useDoubleClick({
  delay = 180,
  disabled = false,
  onSingleClick,
  onDoubleClick,
}: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSingleClickRef = useRef(onSingleClick);
  const onDoubleClickRef = useRef(onDoubleClick);

  useEffect(() => {
    onSingleClickRef.current = onSingleClick;
    onDoubleClickRef.current = onDoubleClick;
  }, [onSingleClick, onDoubleClick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (disabled) return;

      // 由 hook 接管当前点击，避免按钮自己的 onClick 在双击确认前先执行。
      event.preventDefault();
      event.stopPropagation();

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        onDoubleClickRef.current();
        return;
      }

      // 先缓存一次“可能是单击”的点击，等到 delay 后仍无第二次点击再执行。
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onSingleClickRef.current();
      }, delay);
    },
    [delay, disabled]
  );
}
