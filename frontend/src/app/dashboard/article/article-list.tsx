'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePolling } from '../_hooks/use-polling';
import { Article } from './article';
import { UploadArticle } from './upload-article';
import { useDashboardStore } from '../_store/store';

/**
 * ArticleList (文章列表)
 * 职责：以垂直列表形式展示采集的文章。
 */
export function ArticleList() {
	const { articles, fetchArticles, isArticleLoading } = useDashboardStore(
		useShallow((s) => ({
			articles: s.articles,
			fetchArticles: s.fetchArticles,
			isArticleLoading: s.isArticleLoading,
		}))
	);

	// 监听文章状态并自动刷新轮询（当有正在处理的文章时）
	usePolling(articles, fetchArticles);

	return (
		<main className="w-full flex-1">
			{/* 模拟地址栏 - 吸顶 */}
			<div className="sticky top-[65px] z-40 bg-base-200/95 backdrop-blur-sm px-4 md:px-6 py-4 border-b border-base-300 mb-1">
				<div className="max-w-6xl mx-auto">
					<UploadArticle />
				</div>
			</div>

			<div className="flex flex-col gap-3 p-4 pt-1 md:px-6 md:pb-6 md:pt-0">
				{isArticleLoading && articles.length === 0 ? (
					<div className="flex justify-center py-10">
						<span className="loading loading-spinner loading-lg text-primary opacity-20"></span>
					</div>
				) : (
					articles.map((article) => (
						<Article key={article.id} article={article} />
					))
				)}
				{!isArticleLoading && articles.length === 0 && (
					<div className="flex flex-col items-center justify-center py-20 opacity-30">
						<p className="text-lg">暂无采集的文章</p>
					</div>
				)}
			</div>
		</main>
	);
}
