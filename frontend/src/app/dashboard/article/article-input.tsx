'use client';

import { useRef, useEffect } from 'react';
import type { ClipboardEvent } from 'react';

interface Props {
	name: string;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

const BLOCK_TAGS = new Set([
	'P',
	'DIV',
	'SECTION',
	'ARTICLE',
	'BLOCKQUOTE',
	'LI',
	'UL',
	'OL',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
]);

const escapeAttribute = (value: string) => value.replace(/"/g, '&quot;');

const getArticleResourceUrl = (src: string) => {
	if (!/^https?:\/\//i.test(src)) return src;
	return `/api/articles/resource?url=${encodeURIComponent(src)}`;
};

/**
 * 把粘贴进来的 HTML 转成 textarea 里可读、可提交的字符串。
 *
 * 这是一个递归函数：
 * - 文本节点：直接返回文字。
 * - img 节点：保留为简化版 `<img src="...">`。
 * - br 节点：转成真实换行符 `\n`。
 * - 块级节点：递归处理子节点，并在前后补 `\n` 保留段落结构。
 * - 其它标签：不保留标签本身，只递归提取内部文本。
 */
const toPlainTextWithImages = (node: Node): string => {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent ?? '';
	}

	if (!(node instanceof HTMLElement)) return '';

	if (node.tagName === 'IMG') {
		const src = node.getAttribute('src');
		return src ? ` <img src="${escapeAttribute(getArticleResourceUrl(src))}"> ` : '';
	}

	if (node.tagName === 'BR') {
		return '\n';
	}

	const content = Array.from(node.childNodes).map(toPlainTextWithImages).join('');
	return BLOCK_TAGS.has(node.tagName) ? `\n${content.trim()}\n` : content;
};

const normalizePastedContent = (content: string) =>
	content
		// 删除换行前的空格或 tab，避免出现“句尾空格 + 换行”。
		.replace(/[ \t]+\n/g, '\n')
		// 删除换行后的空格或 tab，让每一行都从真实内容开始。
		.replace(/\n[ \t]+/g, '\n')
		// 连续 3 个以上换行压缩成 2 个，保留段落空行但避免空白过多。
		.replace(/\n{3,}/g, '\n\n')
		// 去掉整段内容开头和结尾的空白。
		.trim();

/**
 * ArticleInput: 支持自动高度调整的文本输入框
 * 逻辑：
 * 1. 默认 1 行高 (看起来像 input)。
 * 2. 随内容增加自动向下伸长。
 * 3. 最大高度限制为 3 行 (超过后出现内部滚动条)。
 */
export function ArticleInput({ name, placeholder, disabled, className }: Props) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// 自动调整高度的函数
	const adjustHeight = () => {
		const el = textareaRef.current;
		if (!el) return;

		// 1. 重置高度以重新计算 scrollHeight
		el.style.height = 'auto';

		// 2. 计算新高度
		const newHeight = el.scrollHeight;
		el.style.height = `${newHeight}px`;

		// 3. 溢出处理：如果高度超过 max-height (这里约 104px)，则允许滚动，否则隐藏滚动条
		// 104 是根据 max-h-[6.5rem] (16 * 6.5) 计算得出的
		if (newHeight >= 104) {
			el.style.overflowY = 'auto';
		} else {
			el.style.overflowY = 'hidden';
		}
	};

	const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
		// 读取剪贴板中的 HTML 内容；普通纯文本粘贴不会走这条分支。
		const html = event.clipboardData.getData('text/html');
		if (!html || !html.includes('<img')) {
			return;
		}

		// 解析 HTML，确认里面确实包含带 src 的图片。
		const doc = new DOMParser().parseFromString(html, 'text/html');
		const hasImages = doc.querySelectorAll('img[src]').length > 0;
		if (!hasImages) return;

		// 将 HTML 归一化为“纯文本 + 简化 img 标签 + 段落换行”。
		const pastedContent = normalizePastedContent(toPlainTextWithImages(doc.body));
		if (!pastedContent) return;

		// 接管这次粘贴，把带 img tag 的 HTML 字符串插入到当前光标位置。
		event.preventDefault();
		event.currentTarget.setRangeText(
			pastedContent,
			event.currentTarget.selectionStart,
			event.currentTarget.selectionEnd,
			'end'
		);
		adjustHeight();
	};

	// 初次挂载或禁用状态改变时触发一次校准
	useEffect(() => {
		adjustHeight();
	}, [disabled]);

	return (
		<textarea
			ref={textareaRef}
			name={name}
			rows={1}
			onInput={adjustHeight}
			onPaste={handlePaste}
			placeholder={placeholder}
			disabled={disabled}
			className={`
				textarea textarea-bordered join-item w-full 
				focus:outline-none focus:border-primary border-r-0
				resize-none transition-all duration-200 ease-in-out
				py-[11px] min-h-[3rem] max-h-[6.5rem] leading-normal
				overflow-hidden
				${className}
			`}
		/>
	);
}
