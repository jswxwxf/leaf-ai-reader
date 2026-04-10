import { parseHTML } from 'linkedom';

/**
 * 为 HTML 字符串注入句子 ID，但不改变原有 HTML 结构
 * 适用场景：标准 HTML、Readability 输出、EPUB 内容处理等
 * 
 * @param html HTML 片段字符串
 * @returns 注入 <span> 标签后的 HTML 字符串
 */
export function injectSentenceIds(html: string): string {
	if (!html) return "";

	const { document } = parseHTML(`<div>${html}</div>`);
	const container = document.querySelector('div')!;
	let sentenceId = 0;

	const walk = (node: any) => {
		if (node.nodeType === 3) { // 文本节点
			const text = node.textContent?.trim();
			if (!text) return;

			// 匹配以标点（。！？!?……）结尾的片段，或者不带标点的片段
			const regex = /([^。！？!?……\n]+([。！？!?……\n]|\.{3})*)/g;
			const matches = text.match(regex);
			
			if (matches) {
				const fragments = matches.map((s: string) => {
					const span = document.createElement('span');
					span.className = 'sentence';
					span.id = `s-${++sentenceId}`;
					span.textContent = s.trim();
					return span;
				});
				
				// 用 span 替换原文本节点
				fragments.forEach((span: any) => node.parentNode.insertBefore(span, node));
				node.parentNode.removeChild(node);
			}
		} else if (node.nodeType === 1) { // 元素节点
			// 递归处理子节点
			const children = Array.from(node.childNodes);
			children.forEach(walk);
		}
	};

	walk(container);
	return container.innerHTML;
}
