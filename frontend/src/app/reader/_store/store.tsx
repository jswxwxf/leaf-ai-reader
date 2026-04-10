'use client';

import React, { createContext, use, useState } from 'react';
import { createStore, useStore } from 'zustand';
import { combine, persist, createJSONStorage } from 'zustand/middleware';
import { createUrlSearchStorage } from '@/lib/zustand-helpers';

import { type ArticleData } from '@/lib/article';
import { type BookData } from '@/lib/book';

export type ReaderMode = 'article' | 'book';

/**
 * 初始状态定义
 */
export type InitialState = {
	mode?: ReaderMode | null;
	article_id?: string | null;
	book_id?: string | null;
	data?: ArticleData | BookData | null;
	content?: string;
};

/**
 * 状态定义（数据）
 */
export interface ReaderState {
	mode: ReaderMode | null;
	article_id: string | null;
	book_id: string | null;
	data: ArticleData | BookData | null;
	content: string;
	isLoading: boolean;
}

/**
 * 动作定义（方法）
 */
export interface ReaderActions {
	setMode: (mode: ReaderMode | null) => void;
	setArticleId: (id: string | null) => void;
	setBookId: (id: string | null) => void;
	setData: (data: ArticleData | BookData | null) => void;
	setContent: (content: string) => void;
}

/**
 * 完整的 Store 状态类型
 */
export type ReaderStoreState = ReaderState & ReaderActions;

/**
 * 创建 Store 的工厂函数
 */
const createReaderStore = (initialState: InitialState = {}) => {
	const { 
		mode = null, 
		article_id = null, 
		book_id = null,
		data = null,
		content = ""
	} = initialState;

	return createStore<ReaderStoreState>()(
		persist(
			combine<ReaderState, ReaderActions>(
				{
					mode,
					article_id,
					book_id,
					data,
					content,
					isLoading: false,
				},
				(set, get) => ({
					setMode: (mode) => set({ mode }),
					setArticleId: (id) => set({ 
						article_id: id, 
						mode: id ? 'article' : (get().book_id ? 'book' : null) 
					}),
					setBookId: (id) => set({ 
						book_id: id, 
						mode: get().article_id ? 'article' : (id ? 'book' : null) 
					}),
					setData: (data) => set({ data }),
					setContent: (content) => set({ content }),
				})
			),
			{
				name: 'reader-storage',
				// 使用之前在 Dashboard 中定义的帮助函数同步到 URL
				storage: createJSONStorage(() => createUrlSearchStorage(['article_id', 'book_id'])),
				partialize: (state) => ({ 
					article_id: state.article_id, 
					book_id: state.book_id 
				}),
				// 在从 URL 恢复状态后，重新计算一次 mode
				merge: (persistedState: any, currentState) => {
					const article_id = persistedState?.article_id ?? currentState.article_id;
					const book_id = persistedState?.book_id ?? currentState.book_id;
					return {
						...currentState,
						...persistedState,
						mode: article_id ? 'article' : (book_id ? 'book' : null)
					};
				},
			}
		)
	);
};

export type ReaderStore = ReturnType<typeof createReaderStore>;

/**
 * Context 定义
 */
const ReaderStoreContext = createContext<ReaderStore | null>(null);

type Props = {
	initialState?: InitialState;
};

/**
 * Provider 组件
 */
export function ReaderStoreProvider({
	children,
	initialState = {}
}: React.PropsWithChildren<Props>) {
	const [store] = useState(() => createReaderStore(initialState));

	return (
		<ReaderStoreContext value={store}>
			{children}
		</ReaderStoreContext>
	);
}

/**
 * Hook 定义
 */
export function useReaderStore<T>(selector: (state: ReaderStoreState) => T): T {
	const context = use(ReaderStoreContext);
	if (!context) {
		throw new Error('useReaderStore must be used within a ReaderStoreProvider');
	}
	return useStore(context, selector);
}
