import { useEffect, useRef } from 'react';
import { BookData } from '@/lib/book';

/**
 * 书籍状态轮询 Hook
 * 职责：当书架中存在正在处理的书籍时，自动开启定时刷新，直到处理完成或达到最大重试次数。
 */
export function useBookPolling(books: BookData[], refreshBooks: () => Promise<void>) {
	const pollCountRef = useRef(0);
	// 记录上一次是否有未完成的任务，用于检测“新任务开始”以重置计数
	const lastHasIncompleteRef = useRef(false);

	useEffect(() => {
		// 1. 检查当前是否有正在处理的书籍
		const hasIncomplete = books.some(b => b.status === 'uploading' || b.status === 'processing');

		// 2. 如果任务状态从“全部完成”变为“有未完成”，或者书架为空，则重置计数器
		if (books.length === 0 || (!lastHasIncompleteRef.current && hasIncomplete)) {
			pollCountRef.current = 0;
		}
		lastHasIncompleteRef.current = hasIncomplete;

		// 3. 如果没有未完成的任务，或者已经达到轮询上限，则不开启定时器
		if (!hasIncomplete) {
			return;
		}

		if (pollCountRef.current >= 5) {
			console.log(`[useBookPolling] 已达到最大轮询次数 (${pollCountRef.current})，停止后台刷新。`);
			return;
		}

		// 4. 使用 setTimeout 代替 setInterval，配合依赖项 books，
		// 每次 books 更新（即 refreshBooks 完成后）都会触发 Effect 重新进入，
		// 从而实现“等待上一次完成再开始下一次计时”的效果，避免并发堆积。
		const timeoutId = setTimeout(() => {
			pollCountRef.current++;
			console.log(`[useBookPolling] 正在进行第 ${pollCountRef.current} 次自动刷新...`);
			refreshBooks();
		}, 3000);

		return () => clearTimeout(timeoutId);
	}, [books, refreshBooks]);
}
