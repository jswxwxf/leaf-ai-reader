'use client';

import { useShallow } from 'zustand/react/shallow';
import { useBookStore } from '../book/_store/book-store';

/**
 * ViewSwitcher (视图切换器)
 * 职责：处理“图书”和“文章”视图的切换，并在客户端维护 URL 同步。
 */
export function ViewSwitcher() {
	const { view, setView } = useBookStore(
		useShallow((s) => ({
			view: s.view,
			setView: s.setView,
		}))
	);

	const handleViewChange = (newView: 'books' | 'articles') => {
		setView(newView);
	};

	return (
		<div className="flex items-center gap-1 bg-base-200 p-1 rounded-lg">
			<button
				onClick={() => handleViewChange('books')}
				className={`btn btn-sm btn-ghost px-3 ${view === 'books' ? 'bg-base-100 shadow-sm text-primary hover:bg-base-100' : 'hover:bg-base-300'}`}
			>
				图书
			</button>
			<button
				onClick={() => handleViewChange('articles')}
				className={`btn btn-sm btn-ghost px-3 ${view === 'articles' ? 'bg-base-100 shadow-sm text-primary hover:bg-base-100' : 'hover:bg-base-300'}`}
			>
				文章
			</button>
		</div>
	);
}
