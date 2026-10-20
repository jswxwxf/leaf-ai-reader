import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import type { BookData } from "@/lib/book";
import { getNextChapter } from "../_components/speecher";
import { useReaderStore } from "../_store/store";

/** 找到目标元素后模拟点击，并阻止默认滚动和长按重复触发。 */
function handleElementClick(event: KeyboardEvent, selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;

  event.preventDefault();
  if (!event.repeat) target.click();
}

/** 管理下一章快捷键的可用性和整页跳转。 */
function useNextChapter() {
  const searchParams = useSearchParams();
  const { mode, data, isContentLoading } = useReaderStore(
    useShallow((state) => ({
      mode: state.mode,
      data: state.data,
      isContentLoading: state.isContentLoading,
    }))
  );

  return useCallback((event: KeyboardEvent) => {
    if (mode !== "book") return;
    event.preventDefault();
    if (event.repeat || isContentLoading || !data) return;

    // 直接查找下一章并导航，不再模拟点击链接。
    const path = searchParams.get("path");
    if (!path) return;
    const bookData = data as BookData;
    const nextChapter = getNextChapter(bookData.flattenChapters || [], path);
    if (!nextChapter) return;

    // 整页加载下一章，让阅读器和浏览器语音相关状态重新初始化。
    window.location.assign(
      `/reader?book_id=${encodeURIComponent(bookData.id)}&path=${encodeURIComponent(nextChapter.path)}`
    );
  }, [mode, data, isContentLoading, searchParams]);
}

/**
 * 键盘快捷键监听 Hook
 */
export function useShortCuts({
  isPlaying,
  play,
  stop,
  step,
}: {
  isPlaying: boolean;
  play: () => void;
  stop: () => void;
  step: (delta: number) => void;
}) {
  const handleNextChapter = useNextChapter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果焦点在输入元素上，不触发快捷键
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault(); // 防止页面滚动
        if (isPlaying) {
          stop();
        } else {
          play();
        }
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.code === "ArrowUp") {
        // 复用“生成摘要”按钮；按钮不存在或正在生成时不触发。
        handleElementClick(
          event,
          "[data-generate-summary]:not(:disabled)"
        );
      } else if (event.code === "ArrowDown") {
        handleNextChapter(event);
      } else if (
        event.code === "KeyS" &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        // Shift + S：复用摘要标题区域的朗读入口。
        handleElementClick(event, '[data-read-summaries="true"]');
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, play, stop, step, handleNextChapter]);
}
