import { parseHTML } from 'linkedom';

/**
 * 将文本拆分为句子
 */
export function splitSentences(text: string): string[] {
	if (!text.trim()) return [];

	const sentences: string[] = [];
	const terminators = "。！？；：!?……";
	const closers = "”’』」》）〉】〗｝\"')]}";

	let current = "";
	let depth = 0;
	const openers = "《(（[【〔";
	const closers_pair = "》)）]】〕";

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		current += char;

		// 追踪层级深度
		if (openers.includes(char)) depth++;
		if (closers_pair.includes(char)) depth = Math.max(0, depth - 1);

		// 遇到换行，强制切断
		if (char === '\n') {
			if (current.trim()) sentences.push(current.trim());
			current = "";
			depth = 0; // 换行重置深度，防止坏数据导致后续全失效
			continue;
		}

		// 检查是否遇到结束标点
		if (terminators.includes(char)) {
			// 特殊处理：如果处于书名号或各种括号内部，且当前是冒号，则不断句
			if (depth > 0 && char === '：') {
				continue;
			}

			// 1. 尽可能多地吞掉连续的终结符 (如 …… 或 !!!)
			while (i + 1 < text.length && terminators.includes(text[i + 1])) {
				const nextChar = text[++i];
				current += nextChar;
				// 即使是终结符，如果是括号，也要更新深度（虽然罕见）
				if (openers.includes(nextChar)) depth++;
				if (closers_pair.includes(nextChar)) depth = Math.max(0, depth - 1);
			}

			// 2. 尽可能吞掉后面的连续闭合符号 (如 》” )
			let swallowedAnyCloser = false;

			while (i + 1 < text.length && closers.includes(text[i + 1])) {
				current += text[++i];
				swallowedAnyCloser = true;
			}
			
			// 2. 决策是否在此处切断
			const nextChar = i + 1 < text.length ? text[i + 1] : null;
			const isAtBoundary = !nextChar || nextChar === '\n' || nextChar === ' ' || nextChar === '\u3000';

			if (isAtBoundary) {
				// 场景 A: 后面没内容了，或者紧跟着换行或空格 -> 无论什么符号都断句
				if (current.trim()) {
					sentences.push(current.trim());
				}
				current = "";
			} else {
				// 场景 B/C: 后面紧跟汉字或其他非空字符
				// 为了避免在书名号（《》）或括号（（））内部被终结符意外切断
				const nonSplittableClosers = "》）〕〉】〗｝)]}"; 
				const lastCloser = swallowedAnyCloser ? text[i] : null;
				const isInsideTitleOrBrackets = lastCloser && nonSplittableClosers.includes(lastCloser);

				if (!isInsideTitleOrBrackets) {
					// 如果没吞掉闭合符，或者是引号类闭合符，则断句
					if (current.trim()) {
						sentences.push(current.trim());
					}
					current = "";
				} else {
					// 书名号、括号等特殊情况 -> 保持不断句
					continue;
				}
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
