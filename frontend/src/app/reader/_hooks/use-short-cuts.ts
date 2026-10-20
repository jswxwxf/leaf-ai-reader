import { useEffect } from "react";

/** 找到目标元素后模拟点击，并阻止默认滚动和长按重复触发。 */
function handleElementClick(event: KeyboardEvent, selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;

  event.preventDefault();
  if (!event.repeat) target.click();
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
        // 复用现有“下一章”链接的点击行为；末章和文章模式下不会找到可用链接。
        handleElementClick(
          event,
          '[data-next-chapter="true"]'
        );
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
  }, [isPlaying, play, stop, step]);
}
