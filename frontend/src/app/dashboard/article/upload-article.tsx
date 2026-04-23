'use client';

import { useActionState, useRef } from 'react';
import { request } from '@/lib/request';
import { showAlert } from '@/app/global-modals';
import { useDashboardStore } from '../_store/store';
import { ArticleInput } from './article-input';

/**
 * UploadArticle (文章采集/贴入输入框)
 * 职责：接收用户输入的网址或纯文本，并调用后端接口进行处理。
 */
export function UploadArticle() {
	const formRef = useRef<HTMLFormElement>(null);
	const fetchArticles = useDashboardStore((s) => s.fetchArticles);

	// 使用 useActionState 替代手动的 useState 和 onSubmit 模式
	const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
		const url = (formData.get('url') as string)?.trim();
		if (!url) return null;

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
			className="join w-full items-start"
		>
			<ArticleInput
				name="url"
				placeholder="粘贴文章网址或长文本内容..."
				disabled={isPending}
			/>
			<button
				type="submit"
				disabled={isPending}
				className="btn btn-primary join-item px-8 text-base gap-2 h-[3rem]"
			>
				<span className={isPending ? 'animate-pulse' : ''}>阅读</span>
			</button>
		</form>
	);
}
