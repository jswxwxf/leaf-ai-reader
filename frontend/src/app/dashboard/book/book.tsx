"use client";

import Link from 'next/link';
import { AlertCircle, Loader2, Book as BookIcon, X } from 'lucide-react';
import Image from 'next/image';
import { BookData, deleteBook } from '@/lib/book';
import { useBookStore } from '../../_store/book-store';
import { showLoading, hideLoading } from '@/app/full-screen-loading';
import { showAlert, showConfirm } from '@/app/global-modals';

interface Props {
	book: BookData;
}

/**
 * 书籍组件
 * 职责：展示单本书籍的核心卡片 UI。
 */
export function Book({ book }: Props) {
	const fetchBooks = useBookStore((s) => s.fetchBooks);

	// 简化判断：直接通过 cover_r2_key 作为查询参数，API 侧会根据用户 ID 校验该 key
	const coverUrl = book.cover_r2_key ? `/api/books/cover?key=${encodeURIComponent(book.cover_r2_key)}` : null;

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault(); // 额外防止 Link 跳转
		await showConfirm({
			message: `确定要从书架移除《${book.title}》吗？`,
		});

		try {
			showLoading()
			await deleteBook(book.id);
			await fetchBooks();
		} catch (error) {
			showAlert({
				message: '删除失败，请稍后重试',
			});
			console.error('[handleDelete Error]', error);
		} finally {
			hideLoading()
		}
	};

	return (
		<Link
			href={`/reader?book_id=${book.id}`}
			className="card card-side bg-base-100 shadow-sm hover:shadow-md active:scale-[0.98] active:bg-base-200 transition-all cursor-pointer overflow-hidden border border-base-200 group h-[180px] relative"
		>
			{/* 删除按钮 (仅在悬停时显示) */}
			<button
				className="absolute top-2 right-2 z-20 btn btn-circle btn-xs btn-error opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-sm border-none"
				onClick={handleDelete}
				title="删除书籍"
			>
				<X className="w-3 h-3 text-white" />
			</button>

			{/* 状态徽章 (仅在非 ready 状态显示) */}
			{book.status !== 'ready' && (
				<div className="absolute bottom-4 right-4 z-10">
					{book.status === 'error' ? (
						<div className="badge badge-error gap-1 text-[10px] font-bold py-2">
							<AlertCircle className="w-3 h-3" />
							失败
						</div>
					) : (
						<div className="badge badge-primary gap-1 text-[10px] font-bold py-2 animate-pulse">
							<Loader2 className="w-3 h-3 animate-spin" />
							处理中
						</div>
					)}
				</div>
			)}

			{/* 书籍封面区域 */}
			<figure className="relative w-28 min-w-[112px] h-full bg-base-300">
				{coverUrl ? (
					<Image
						src={coverUrl}
						alt={book.title}
						fill
						unoptimized
						className={`object-cover group-hover:scale-105 transition-transform duration-300 ${book.status !== 'ready' ? 'grayscale opacity-40' : ''
							}`}
						sizes="112px"
					/>
				) : (
					<div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-linear-to-br from-base-300 to-base-200 opacity-60">
						<BookIcon className="w-8 h-8 mb-2 opacity-20" />
						<span className="text-[10px] font-medium line-clamp-3 leading-tight opacity-40">
							{book.title}
						</span>
					</div>
				)}
			</figure>

			{/* 书籍信息 */}
			<div className="card-body p-4 pt-5">
				<h2 className="card-title text-base font-bold line-clamp-2 leading-tight h-10 items-start mb-1" title={book.title}>
					{book.title}
				</h2>
				<div className="text-[11px] opacity-60 space-y-1 mt-2">
					<p className="truncate" title={book.author || '未知'}>
						<span className="opacity-70">作者：</span>
						{book.author || '未知'}
					</p>
					{book.published_at && (
						<p className="truncate">
							<span className="opacity-70">出版日期：</span>
							{book.published_at.split('T')[0]}
						</p>
					)}
				</div>
			</div>
		</Link>
	);
}
