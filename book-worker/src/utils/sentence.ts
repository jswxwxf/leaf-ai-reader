import { parseHTML } from 'linkedom';

/**
 * 将文本拆分为句子
 */
export function splitSentences(text: string): string[] {
	if (!text.trim()) return [];

	const sentences: string[] = [];
	const terminators = "。！？!?……";
	const closers = "”’』」》）〉】〗｝\"')]}";
	
	let current = "";
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		current += char;

		// 遇到换行，强制切断
		if (char === '\n') {
			if (current.trim()) sentences.push(current.trim());
			current = "";
			continue;
		}

		// 检查是否遇到结束标点
		if (terminators.includes(char)) {
			// 1. 尽可能吞掉后面的连续闭合符号 (如 》” )
			while (i + 1 < text.length && closers.includes(text[i + 1])) {
				current += text[++i];
			}
			
			// 2. 决策是否在此处切断
			const nextChar = i + 1 < text.length ? text[i + 1] : null;
			
			// 核心决策逻辑：
			if (!nextChar || nextChar === '\n' || nextChar === ' ' || nextChar === '\u3000') {
				// 场景 A: 后面没内容了，或者紧跟着换行或空格 -> 此时肯定执行断句
				if (current.trim()) {
					sentences.push(current.trim());
				}
				current = "";
			} else if (char === '。') {
				// 场景 B: 哪怕后面没有空格，只要是中文句号 '。' -> 也执行断句（解决微信这种无空格排版）
				if (current.trim()) {
					sentences.push(current.trim());
				}
				current = "";
			} else {
				// 场景 C: 针对英文或其他标点（如“？》系列”），如果没空格且不是句号，不断句
				continue;
			}
		}
	}

	if (current.trim()) {
		sentences.push(current.trim());
	}
	
	return sentences.filter(Boolean);
}

/**
 * 为 HTML 字符串注入句子 ID，但不改变原有 HTML 结构
 */
export function injectSentenceIds(html: string): string {
	if (!html) return "";

	const { document } = parseHTML(`<div>${html}</div>`);
	const container = document.querySelector('div')!;
	let sentenceId = 0;

	const walk = (node: any) => {
		if (node.nodeType === 3) {
			const text = node.textContent;
			if (!text || !text.trim()) return;

			const matches = splitSentences(text);
			
			if (matches.length > 0) {
				const fragment = document.createDocumentFragment();
				matches.forEach((s: string) => {
					const span = document.createElement('span');
					span.className = 'sentence';
					span.id = `s-${++sentenceId}`;
					span.textContent = s;
					fragment.appendChild(span);
				});
				
				node.parentNode.replaceChild(fragment, node);
			}
		} else if (node.nodeType === 1) {
			Array.from(node.childNodes).forEach(walk);
		}
	};

	walk(container);
	return container.innerHTML;
}
