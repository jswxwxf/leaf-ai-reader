import { useCallback, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

interface Options {
  /** 是否禁用全部点击与手势响应。 */
  disabled?: boolean;
  /** 手指从右向左划过时触发。 */
  onSwipeLeft?: () => void;
  /** 手指从左向右划过时触发。 */
  onSwipeRight?: () => void;
  /** 未识别为滑动时的普通点击回调。 */
  onTap?: () => void;
  /** 触发左右滑动所需的最小水平移动距离，单位为像素。 */
  threshold?: number;
}

/**
 * 为单个元素提供轻量的左右滑动和点击处理。
 *
 * 通过 Pointer Events 同时支持触摸屏、鼠标与触控笔。一次移动只有在以下条件
 * 同时成立时才会被认为是左右滑动：
 *
 * - 水平移动距离达到 `threshold`；
 * - 水平移动距离大于垂直移动距离，避免拦截页面的纵向滚动。
 *
 * 浏览器会在触摸滑动结束后额外派发一次 `click`。hook 会在识别到滑动时记录
 * 该状态，并在紧随其后的 click 阶段将其吞掉，避免滑动和 `onTap` 同时触发。
 * 调用方可将返回值直接展开到目标元素：`<div {...swipeHandlers} />`。
 */
export function useSwipe({
  disabled = false,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  threshold = 40,
}: Options) {
  // 仅保存一次手势的起点；pointerId 用于忽略其他手指或指针的事件。
  const startRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  // 标记本次 pointerup 是否已识别为滑动，用来阻止浏览器随后合成的 click。
  const shouldIgnoreClickRef = useRef(false);

  // 按下时记录坐标。不处理非主指针，也不处理鼠标右键等非主按键。
  const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (disabled || !event.isPrimary || event.button !== 0) return;

    // 部分浏览器在滑动后不会派发合成 click；新手势开始时清除可能残留的标记，
    // 避免下一次真实点击被当作上一次滑动后的 click 吞掉。
    shouldIgnoreClickRef.current = false;
    startRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }, [disabled]);

  // 抬起时比较起止坐标；只有以水平方向为主且距离足够时才触发方向回调。
  const handlePointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    const start = startRef.current;
    startRef.current = null;

    if (disabled || !start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    shouldIgnoreClickRef.current = true;
    if (deltaX > 0) {
      onSwipeRight?.();
    } else {
      onSwipeLeft?.();
    }
  }, [disabled, onSwipeLeft, onSwipeRight, threshold]);

  // 手势被浏览器取消（例如开始原生滚动）时，不保留未完成的起点。
  const handlePointerCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  // 普通点击触发 onTap；若前一个 pointerup 已触发滑动，则吞掉该 click。
  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (disabled) return;

    if (shouldIgnoreClickRef.current) {
      shouldIgnoreClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onTap?.();
  }, [disabled, onTap]);

  // 返回 React 的 capture 阶段属性，可直接通过 JSX 展开绑定到交互区域。
  return {
    onPointerDownCapture: handlePointerDown,
    onPointerUpCapture: handlePointerUp,
    onPointerCancelCapture: handlePointerCancel,
    onClickCapture: handleClick,
  };
}
