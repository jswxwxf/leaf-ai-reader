import { useMemo } from 'react';
import { type AISummary } from '../_store/store';

/**
 * 为 AI 摘要中包含的句子生成背景高亮样式的 Hook
 */
export function useSummaryHighlight(summaries: AISummary[] | undefined) {
    const highlightCss = useMemo(() => {
        if (!summaries || summaries.length === 0) return '';

        // 提取所有在摘要中出现的 s-id
        const allSIds = Array.from(new Set(summaries.map(s => s.start_sId)));
        
        if (allSIds.length === 0) return '';

        // 生成针对 ID 的选择器列表
        const selectors = allSIds.map(id => `#leaf-reader-content #${id}`).join(', ');
        
        return `
            ${selectors} {
                background-color: rgba(234, 189, 58, 0.1); 
                border-radius: 4px;
                transition: background-color 0.3s ease;
            }

            ${selectors}:hover {
                background-color: rgba(234, 189, 58, 0.2);
            }
        `;
    }, [summaries]);

    return highlightCss;
}
