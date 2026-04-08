"use client";

import { Loader2 } from 'lucide-react';
import { Book } from './book';
import { UploadBook } from './upload-book';
import { useShallow } from 'zustand/react/shallow';
import { useBookStore } from '../_store/book-store';
import { useBookPolling } from '../_hooks/use-book-polling';

/**
 * BookShelf (书架) 是一个客户端容器 (Client Component)
 */
export function BookShelf() {
	const { books, isLoading, fetchBooks } = useBookStore(
		useShallow((s) => ({
			books: s.books,
			isLoading: s.isLoading,
			fetchBooks: s.fetchBooks,
		}))
	);


	// 监听书籍状态并自动刷新轮询
	useBookPolling(books, fetchBooks);


	return (
		<main className="p-4 md:p-6 w-full flex-1 flex flex-col">
			{isLoading && books.length === 0 ? (
				/* 加载中状态 */
				<div className="flex-1 flex items-center justify-center p-12">
					<div className="flex flex-col items-center gap-4">
						<Loader2 className="w-10 h-10 text-primary animate-spin" />
						<p className="text-sm opacity-60">加载书籍列表中...</p>
					</div>
				</div>
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
