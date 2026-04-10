"use client";

import { use, useEffect } from 'react';
import { Book } from './book';
import { UploadBook } from './upload-book';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore } from '../_store/store';
import { usePolling } from '../_hooks/use-polling';
import { Loading } from '../_components/loading';
import { BookData } from '@/lib/book';

/**
 * BookShelf (书架) 是一个客户端容器 (Client Component)
 */
export function BookShelf({ booksPromise }: { booksPromise: Promise<BookData[]> }) {
	// 使用 use() 解析从服务器传下来的 Promise
	const initialBooks = use(booksPromise);

	const { books, isBookLoading, fetchBooks, setBooks } = useDashboardStore(
		useShallow((s) => ({
			books: s.books,
			isBookLoading: s.isBookLoading,
			fetchBooks: s.fetchBooks,
			setBooks: s.setBooks,
		}))
	);

	// 数据同步：将服务器解析出的初始数据同步到全局 Store
	// 这样可以确保其他依赖 Store 的组件（如侧边栏计数等）能够获取到最新数据
	useEffect(() => {
		if (initialBooks && books.length === 0) {
			setBooks(initialBooks);
		}
	}, [initialBooks, setBooks, books.length]);

	// 监听书籍状态并自动刷新轮询
	usePolling(books, fetchBooks);

	return (
		<main className="p-4 md:p-6 w-full flex-1 flex flex-col">
			{/* 处理后续刷新时的二次加载状态 (可选) */}
			{isBookLoading && books.length === 0 ? (
				<Loading message="刷新书架中..." />
			) : books.length === 0 ? (
				/* 空状态 */
				<div className="flex-1 flex items-center justify-center py-20">
					<UploadBook variant="hero" />
				</div>
			) : (
				/* 列表状态：Grid 布局 */
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
					{/* 第一项：上传新图书小卡片 */}
					<UploadBook variant="compact" />

					{/* 现有图书列表 */}
					{books.map((book) => (
						<Book key={book.id} book={book} />
					))}
				</div>
			)}
		</main>
	);
}
