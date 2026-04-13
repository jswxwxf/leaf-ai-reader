import { useCallback, useMemo } from 'react';

/**
 * 单词高亮管理 Hook (基于 CSS Custom Highlight API)
 */
export function useWordHighlight() {
  const canHighlight = useMemo(() => typeof CSS !== 'undefined' && 'highlights' in CSS, []);

  /**
   * 清除当前所有单词高亮
   */
  const clearHighlight = useCallback(() => {
    if (!canHighlight) return;
    (CSS as any).highlights.get('word-focus')?.clear();
  }, [canHighlight]);

  /**
   * 高亮指定元素的特定范围
   * @param el 目标容器元素
   * @param charIndex 起始字符索引
   * @param charLength 字符长度 (由 SpeechSynthesisUtterance event 提供)
   */
  const highlightWord = useCallback((el: HTMLElement, charIndex: number, charLength?: number) => {
    if (!canHighlight || !el.firstChild || charLength === undefined) {
      return;
    }

    try {
      const range = new Range();
      range.setStart(el.firstChild, charIndex);
      range.setEnd(el.firstChild, charIndex + charLength);

      const highlights = (CSS as any).highlights;
      let wordHighlight = highlights.get('word-focus');
      
      if (!wordHighlight) {
        wordHighlight = new (window as any).Highlight();
        highlights.set('word-focus', wordHighlight);
      }

      wordHighlight.clear();
      wordHighlight.add(range);
    } catch (e) {
      console.error("单词高亮失败:", e);
    }
  }, [canHighlight]);

  return { highlightWord, clearHighlight, canHighlight };
}
