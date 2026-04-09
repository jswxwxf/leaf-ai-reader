'use client';

import { useDashboardStore } from '../_store/store';
import { BookShelf } from '../book/book-shelf';
import { ArticleList } from '../article/article-list';

/**
 * DashboardContainer (仪表盘视图容器)
 * 职责：根据 Store 中的当前视图 (view) 状态，控制图书列表和文章列表的显隐。
 */
export function DashboardContainer() {
	const view = useDashboardStore((s) => s.view);

	return (
		<>
			{/* 图书视图 */}
			<div className={view === 'books' ? 'contents' : 'hidden'}>
				<BookShelf />
			</div>

			{/* 文章视图 */}
			<div className={view === 'articles' ? 'block' : 'hidden'}>
				<ArticleList />
			</div>
		</>
	);
}
