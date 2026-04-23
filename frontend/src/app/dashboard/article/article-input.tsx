'use client';

import { useRef, useEffect } from 'react';

interface Props {
	name: string;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

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
