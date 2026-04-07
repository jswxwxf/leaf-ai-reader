"use client";

import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * 书籍数据模型接口
 */
export interface BookData {
	id: string;
	title: string;
	author?: string;
	status: 'uploading' | 'processing' | 'ready' | 'error';
	created_at: number;
}

interface Props {
	book: BookData;
}

/**
 * 书籍组件 (原为 BookCard)
 * 职责：展示单本书籍的核心卡片 UI。
 */
export function Book({ book }: Props) {
	return (
		<div className="card card-side bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border border-base-200 group h-[180px] relative">
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

			{/* 书籍封面 */}
			<figure className="relative w-32 min-w-[128px] h-full bg-base-300">
				<img
					src={`https://picsum.photos/seed/${book.id}/200/300`}
					alt={book.title}
					className={`object-cover w-full h-full group-hover:scale-105 transition-transform duration-300 ${book.status !== 'ready' ? 'grayscale opacity-40' : ''
						}`}
				/>
			</figure>

			{/* 书籍信息 */}
			<div className="card-body p-4 justify-center">
				<h2 className="font-semibold text-sm line-clamp-2 leading-snug">
					{book.title}
				</h2>
				<p className="text-xs opacity-50 mt-1 truncate">
					{book.author || '未知作者'}
				</p>
			</div>
		</div>
	);
}
