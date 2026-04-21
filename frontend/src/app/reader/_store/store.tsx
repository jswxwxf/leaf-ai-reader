'use client';

import React, { createContext, use, useState } from 'react';
import { createStore, useStore } from 'zustand';
import { combine, persist, createJSONStorage } from 'zustand/middleware';
import { createUrlSearchStorage } from '@/lib/zustand-helpers';
import { request } from '@/lib/request';

import { type ArticleData } from '@/lib/article';
import { type BookData } from '@/lib/book';
import { parseSummaries } from './helpers';

export type ReaderMode = 'article' | 'book';
export type SpeechMode = 'sentence' | 'paragraph' | 'article';

export interface AISummary {
	summary: string;
	start_sId: string;
}

/**
 * 初始状态定义
 */
export type InitialState = {
	mode?: ReaderMode | null;
	article_id?: string | null;
	book_id?: string | null;
	path?: string | null;
	speechMode?: SpeechMode;
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
	path: string | null;
	data: ArticleData | BookData | null;
	content: string;
	summaries: AISummary[];
	summarySentenceId: string | null;
	speechSentenceId: string | null;
	isManualScrolling: boolean;
	isLoading: boolean;
	isContentLoading: boolean;
	isPlaying: boolean;
	speechMode: SpeechMode;
	isChaptersOpen: boolean;
	contentRef: React.RefObject<HTMLDivElement | null> | null;
}

/**
 * 动作定义（方法）
 */
export interface ReaderActions {
	setMode: (mode: ReaderMode | null) => void;
	setArticleId: (id: string | null) => void;
	setBookId: (id: string | null) => void;
	setPath: (path: string | null) => void;
	setContent: (content: string) => void;
	setIsContentLoading: (isLoading: boolean) => void;
	setSpeechSentenceId: (id: string | null) => void;
	setSummarySentenceId: (id: string | null) => void;
	setIsManualScrolling: (isManual: boolean) => void;
	setIsPlaying: (isPlaying: boolean) => void;
	setSpeechMode: (mode: SpeechMode) => void;
	setSummaries: (summaries: AISummary[]) => void;
	setChaptersOpen: (isOpen: boolean) => void;
	setContentRef: (ref: React.RefObject<HTMLDivElement | null> | null) => void;
	fetchBookChapter: (bookId: string, path: string) => Promise<void>;
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
		path = null,
		data = null,
		content = "",
		speechMode = 'sentence'
	} = initialState;

	return createStore<ReaderStoreState>()(
		persist(
			combine<ReaderState, ReaderActions>(
				{
					mode,
					article_id,
					book_id,
					path,
					data,
					content,
					summaries: parseSummaries(data),
					summarySentenceId: null,
					speechSentenceId: null,
					isManualScrolling: false,
					isLoading: false,
					isContentLoading: false,
					isPlaying: false,
					speechMode,
					isChaptersOpen: false,
					contentRef: null,
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
					setPath: (path) => set({ path }),
					setData: (data: ArticleData | BookData | null) => {
						set({ data, summaries: parseSummaries(data) });
					},
					setContent: (content) => set({ content }),
					setIsContentLoading: (isContentLoading) => set({ isContentLoading }),
					setSummarySentenceId: (summarySentenceId) => set({ summarySentenceId }),
					setSpeechSentenceId: (speechSentenceId) => set({ speechSentenceId }),
					setIsManualScrolling: (isManualScrolling) => set({ isManualScrolling }),
					setIsPlaying: (isPlaying) => set({ isPlaying }),
					setSpeechMode: (speechMode) => set({ speechMode }),
					setSummaries: (summaries) => set({ summaries }),
					setChaptersOpen: (isChaptersOpen) => set({ isChaptersOpen }),
					setContentRef: (contentRef) => set({ contentRef }),
					fetchBookChapter: async (bookId, path) => {
						const res = await request<{ status: string; content?: string; summary?: any[] }>(
							`/api/books/${bookId}/chapters/${encodeURIComponent(path)}`
						);
						if (res.content) {
							set({
								content: res.content,
								summaries: res.summary || [],
								isContentLoading: false
							});
						}
					},
				})
			),
			{
				name: 'reader-storage',
				// 使用之前在 Dashboard 中定义的帮助函数同步到 URL
				storage: createJSONStorage(() => createUrlSearchStorage(['article_id', 'book_id', 'path', 'speechMode'])),
				partialize: (state) => ({
					article_id: state.article_id,
					book_id: state.book_id,
					path: state.path,
					speechMode: state.speechMode
				})
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

export function useReaderStoreRaw(): ReaderStore {
	const context = use(ReaderStoreContext);
	if (!context) {
		throw new Error('useReaderStoreRaw must be used within a ReaderStoreProvider');
	}
	return context;
}


