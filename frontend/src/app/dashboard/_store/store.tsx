'use client';

import React, { createContext, use, useState } from 'react';
import { createStore, useStore } from 'zustand';
import { combine, persist, createJSONStorage } from 'zustand/middleware';
import { BookData } from '@/lib/book';
import { request } from '@/lib/request';
import { createUrlSearchStorage } from '@/lib/zustand-helpers';

export type InitialState = {
	books?: BookData[];
	view?: 'books' | 'articles';
};

/**
 * 状态定义（数据）
 */
export interface DashboardState {
	view: 'books' | 'articles';
	isBookLoading: boolean;
	books: BookData[];
}

/**
 * 动作定义（方法）
 */
export interface DashboardActions {
	setView: (view: 'books' | 'articles') => void;
	setBooks: (books: BookData[]) => void;
	fetchBooks: () => Promise<void>;
}

/**
 * 完整的 Store 状态类型
 * 先定义“因”（类型契约），再产生“果”（具体实现）
 */
export type DashboardStoreState = DashboardState & DashboardActions;

const createDashboardStore = (initialState: InitialState = {}) => {
	const { books = [], view = 'books' } = initialState;

	return createStore<DashboardStoreState>()(
		persist(
			combine<DashboardState, DashboardActions>(
				{
					// 状态实现 - 必须符合 DashboardState 接口
					view,
					isBookLoading: false,
					books,
				},
				(set) => ({
					// 动作实现 - 必须符合 DashboardActions 接口
					setView: (view) => set({ view }),
					setBooks: (books) => set({ books }),
					fetchBooks: async () => {
						set({ isBookLoading: true });
						try {
							const res = await request<{ books: BookData[] }>('/api/books');
							set({ books: res.books });
						} finally {
							set({ isBookLoading: false });
						}
					},
				})
			),
			{
				name: 'dashboard-storage',
				storage: createJSONStorage(() => createUrlSearchStorage('view')),
				partialize: (state) => ({ view: state.view }), // 仅持久化 view 字段
				// 关键：合并策略，确保服务端传入的 initialState 优先
				merge: (persistedState, currentState) => ({
					...currentState,
					...(persistedState as any),
				}),
			}
		)
	);
};

export type DashboardStore = ReturnType<typeof createDashboardStore>;

const DashboardStoreContext = createContext<DashboardStore | null>(null);

type Props = {
	initialState?: InitialState;
};

export function DashboardStoreProvider({
	children,
	initialState = {}
}: React.PropsWithChildren<Props>) {
	const [store] = useState(() => createDashboardStore(initialState));

	return (
		<DashboardStoreContext value={store}>
			{children}
		</DashboardStoreContext>
	);
}

/**
 * 更加推荐的用法：支持 selector，避免不必要的重渲染
 */
export function useDashboardStore<T>(selector: (state: DashboardStoreState) => T): T {
	const context = use(DashboardStoreContext);
	if (!context) {
		throw new Error('useDashboardStore must be used within a DashboardStoreProvider');
	}
	return useStore(context, selector);
}
