"use client";

import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import type { BookData } from "@/lib/book";

/**
 * 阅读进度条组件 (仅在书籍模式下显示)
 */
export function ReadingProgress() {
	const { data, mode, path } = useReaderStore(
		useShallow((state) => ({
			data: state.data,
			mode: state.mode,
			path: state.path,
		}))
	);

	if (mode !== 'book') return null;

	const bookData = data as BookData;
	const flattenChapters = bookData?.flattenChapters || [];
	const currentIndex = flattenChapters.findIndex(c => c.path === path);
	
	const progress = (flattenChapters.length > 0 && currentIndex !== -1)
		? ((currentIndex + 1) / flattenChapters.length) * 100
		: 0;

	return (
		<div 
			className="absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-300 ease-in-out"
			style={{ width: `${progress}%` }}
		/>
	);
}
