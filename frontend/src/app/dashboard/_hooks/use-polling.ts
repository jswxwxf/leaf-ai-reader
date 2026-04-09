import { useEffect, useRef } from 'react';

interface PollableItem {
	status?: string;
}

/**
 * 通用状态轮询 Hook
 * 职责：当列表（书籍或文章）中存在正在处理的项时，自动开启定时刷新，直到处理完成或达到最大重试次数。
 */
export function usePolling<T extends PollableItem>(
	items: T[],
	fetchData: () => Promise<void>,
	maxPollCount: number = 20 // 默认轮询次数放宽，文章解析可能较慢
) {
	const pollCountRef = useRef(0);
	// 记录上一次是否有未完成的任务，用于检测“新任务开始”以重置计数
	const lastHasIncompleteRef = useRef(false);

	useEffect(() => {
		// 1. 检查当前是否有正在处理的项
		const hasIncomplete = items.some(item =>
			item.status === 'uploading' ||
			item.status === 'processing' ||
			item.status === 'pending'
		);

		// 2. 如果任务状态从“全部完成”变为“有未完成”，或者列表为空，则重置计数器
		if (items.length === 0 || (!lastHasIncompleteRef.current && hasIncomplete)) {
			pollCountRef.current = 0;
		}
		lastHasIncompleteRef.current = hasIncomplete;

		// 3. 如果没有未完成的任务，或者已经达到轮询上限，则不开启定时器
		if (!hasIncomplete) {
			return;
		}

		if (pollCountRef.current >= maxPollCount) {
			console.log(`[usePolling] 已达到最大轮询次数 (${pollCountRef.current})，停止后台刷新。`);
			return;
		}

		// 4. 使用 setTimeout 代替 setInterval，配合依赖项 items，
		// 每次 items 更新（即 fetchData 完成后）都会触发 Effect 重新进入，
		// 从而实现“等待上一次完成再开始下一次计时”的效果，避免并发堆积。
		const timeoutId = setTimeout(() => {
			pollCountRef.current++;
			console.log(`[usePolling] 正在进行第 ${pollCountRef.current} 次自动刷新...`);
			fetchData();
		}, 3000);

		return () => clearTimeout(timeoutId);
	}, [items, fetchData, maxPollCount]);
}
