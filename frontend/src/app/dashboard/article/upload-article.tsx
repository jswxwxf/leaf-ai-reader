'use client';

import { useActionState, useRef } from 'react';
import { request } from '@/lib/request';
import { showAlert } from '@/app/global-modals';
import { useDashboardStore } from '../_store/store';

/**
 * UploadArticle (文章采集输入框)
 * 职责：接收用户输入的网址，并调用后端接口进行采集。
 * 使用 React 19 / Next.js 16 推荐的 Action 模式。
 */
export function UploadArticle() {
	const formRef = useRef<HTMLFormElement>(null);
	const fetchArticles = useDashboardStore((s) => s.fetchArticles);

	// 使用 useActionState 替代手动的 useState 和 onSubmit 模式
	const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
		const url = (formData.get('url') as string)?.trim();
		if (!url) return null;

		// 限制仅支持微信公众号文章
		// const urlPattern = /^https?:\/\/mp\.weixin\.qq\.com\/.+/i;
		// if (!urlPattern.test(url)) {
		// 	showAlert({
		// 		message: '目前仅支持微信公众号文章 (网址须以 https://mp.weixin.qq.com/ 开头)'
		// 	});
		// 	return null;
		// }

		// 已经在 request 工具内部处理了错误弹窗，这里无需再次 catch
		await request('/api/articles/upload', {
			method: 'POST',
			body: JSON.stringify({ url }),
		});

		// 成功后清空输入框
		formRef.current?.reset();
		fetchArticles();
		return { success: true };
	}, null);

	return (
		<form
			ref={formRef}
			action={formAction}
			className="join w-full shadow-sm hover:shadow-md transition-shadow"
		>
			<input
				type="text"
				name="url"
				placeholder="输入微信公众号文章网址"
				disabled={isPending}
				className="input input-bordered join-item w-full focus:outline-none focus:border-primary border-r-0"
			/>
			<button
				type="submit"
				disabled={isPending}
				className="btn btn-primary join-item px-8 text-base gap-2"
			>
				<span className={isPending ? 'animate-pulse' : ''}>阅读</span>
			</button>
		</form>
	);
}
