'use client';

import { Suspense } from 'react';
import { useDashboardStore } from '../_store/store';
import { BookShelf } from '../book/book-shelf';
import { ArticleList } from '../article/article-list';
import { Loading } from './loading';
import { BookData } from '@/lib/book';
import { ArticleData } from '@/lib/article';

type Props = {
	booksPromise: Promise<BookData[]>;
	articlesPromise: Promise<ArticleData[]>;
};

/**
 * DashboardContainer (仪表盘视图容器)
 * 职责：根据 Store 中的当前视图 (view) 状态，控制图书列表和文章列表的显隐。
 */
export function DashboardContainer({
	booksPromise,
	articlesPromise
}: Props) {
	const view = useDashboardStore((s) => s.view);

	return (
		<>
			{/* 图书视图 */}
			<div className={view === 'books' ? 'contents' : 'hidden'}>
				<Suspense fallback={<Loading message="正在为您加载书架..." />}>
					<BookShelf booksPromise={booksPromise} />
				</Suspense>
			</div>

			{/* 文章视图 */}
			<div className={view === 'articles' ? 'block' : 'hidden'}>
				<Suspense fallback={<Loading message="正在为您拉取采集文章..." />}>
					<ArticleList articlesPromise={articlesPromise} />
				</Suspense>
			</div>
		</>
	);
}
