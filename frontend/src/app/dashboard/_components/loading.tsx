'use client';

import { Loader2 } from 'lucide-react';

interface LoadingProps {
	message?: string;
}

/**
 * Loading 是一个通用的加载展示组件
 * 可作为 Suspense 的 fallback 或列表中加载状态的展示
 */
export function Loading({ message = '正在加载中...' }: LoadingProps) {
	return (
		<div className="flex-1 flex items-center justify-center p-12 min-h-[300px]">
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="w-10 h-10 text-primary animate-spin" />
				<p className="text-sm opacity-60 font-medium">{message}</p>
			</div>
		</div>
	);
}
