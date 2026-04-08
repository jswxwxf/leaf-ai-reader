'use client';

import { useBookStore } from '../_store/book-store';
import { BookShelf } from './book-shelf';

/**
 * DashboardContainer (仪表盘视图容器)
 * 职责：根据 Store 中的当前视图 (view) 状态，控制图书列表和文章列表的显隐。
 */
export function DashboardContainer() {
	const view = useBookStore((s) => s.view);

	return (
		<>
			{/* 图书视图 */}
			<div className={view === 'books' ? 'contents' : 'hidden'}>
				<BookShelf />
			</div>

			{/* 文章视图 */}
			<div className={view === 'articles' ? 'block' : 'hidden'}>
				<main className="p-4 md:p-6 w-full flex-1">
					<div className="flex items-center justify-center py-20 bg-base-100 rounded-xl shadow-sm border border-base-300">
						<div className="text-center">
							<h3 className="text-xl font-bold mb-2">文章收藏正在建设中</h3>
							<p className="opacity-60">未来你可以在这里管理从网页采集的精彩内容</p>
						</div>
					</div>
				</main>
			</div>
		</>
	);
}
