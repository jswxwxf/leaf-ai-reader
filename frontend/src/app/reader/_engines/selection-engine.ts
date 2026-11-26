import { useEffect, type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import { showToast } from "@/app/global-toasts";
import { useReaderStore, useReaderStoreRaw, type ReaderStore } from "../_store/store";
import type { SpeechEngine } from "./engine";

// 调用方会在 getText 之后同步调用 speak，选区需要这一句的 DOM 元素。
let pendingSentence: HTMLElement | null = null;

/** 用浏览器原生选区选中整句，包括链接和粗体等行内元素。 */
function select(sentence: HTMLElement): boolean {
  const selection = sentence.ownerDocument.getSelection();
  if (!selection) return false;

  const range = sentence.ownerDocument.createRange();
  range.selectNodeContents(sentence);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/** 复用朗读引擎接口，将当前句设为浏览器原生文本选区。 */
export const selectionEngine: SpeechEngine & { select: typeof select } = {
  select,

  getText(sentence) {
    pendingSentence = sentence;
    // speak 通过 DOM 元素创建选区，返回值仅用于满足接口。
    return "";
  },

  speak({ isCurrentSession, onError }) {
    const sentence = pendingSentence;
    pendingSentence = null;
    if (!sentence || !isCurrentSession()) return;

    if (!select(sentence)) {
      onError(new Error("无法获取浏览器选区"));
    }
    // 省略 onEnd，让句子停留在当前位置，等待用户手动跳句。
  },

  stop() {
    pendingSentence = null;
    // 选中操作同步完成，保留选区供用户复制或翻译。
  },
};

/** 正文加载完成后选中当前句，后续随用户手动跳句更新选区。 */
export function useSentenceSelection(
  sectionRef: RefObject<HTMLElement | null>,
  content: ReturnType<ReaderStore["getState"]>["content"],
  path: ReturnType<ReaderStore["getState"]>["path"],
  isContentLoading: boolean,
  engines: Record<ReturnType<ReaderStore["getState"]>["language"], SpeechEngine>,
) {
  const rawStore = useReaderStoreRaw();
  const { selectionEnabled, speechSentenceId, setSpeechSentenceId } = useReaderStore(
    useShallow((state) => ({
      selectionEnabled: engines[state.language] === selectionEngine,
      speechSentenceId: state.speechSentenceId,
      setSpeechSentenceId: state.setSpeechSentenceId,
    }))
  );

  useEffect(() => {
    const container = sectionRef.current;
    if (!selectionEnabled || isContentLoading || !content || !container) return;

    // 切章时，layout effect 可能已重置当前句，直接读取最新位置。
    const currentId = rawStore.getState().speechSentenceId;
    const sentence = currentId
      ? container.querySelector<HTMLElement>(`[id="${currentId}"]`)
      : container.querySelector<HTMLElement>(".sentence");
    if (!sentence) return;

    if (!select(sentence)) {
      showToast({ message: "选中失败，请重试。", type: "error" });
    }
    // 首次进入时记录第一句的位置，供后续上一句、下一句操作使用。
    if (!currentId) setSpeechSentenceId(sentence.id);
  }, [content, isContentLoading, path, rawStore, sectionRef, selectionEnabled, setSpeechSentenceId, speechSentenceId]);
}
