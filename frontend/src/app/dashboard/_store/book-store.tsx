'use client';

import React, { createContext, useRef, use } from 'react';
import { createStore, useStore } from 'zustand';
import { combine } from 'zustand/middleware';
import { BookData } from '@/lib/book';
import { request } from '@/lib/request';

export type InitialState = {
	books?: BookData[];
	view?: 'books' | 'articles';
};

const createBookStore = (initialState: InitialState = {}) => {
	const { books = [], view = 'books' } = initialState;

	return createStore(
		combine(
			{
				isLoading: false,
				view,
				books,
			},
			(set) => ({
				setView: (view: 'books' | 'articles') => set({ view }),
				setBooks: (books: BookData[]) => set({ books }),
				fetchBooks: async () => {
					set({ isLoading: true });
					try {
						const res = await request<{ books: BookData[] }>('/api/books');
						set({ books: res.books });
					} catch (error) {
						console.error('[BookStore] Failed to fetch books:', error);
					} finally {
						set({ isLoading: false });
					}
				},
			})
		)
	);
};

export type BookStore = ReturnType<typeof createBookStore>;
export type BookStoreState = ReturnType<BookStore['getState']>;

const BookStoreContext = createContext<BookStore | null>(null);

type Props = {
	initialState?: InitialState;
};

export function BookStoreProvider({
	children,
	initialState = {}
}: React.PropsWithChildren<Props>) {
	const storeRef = useRef<BookStore>(null);
	if (!storeRef.current) {
		storeRef.current = createBookStore(initialState);
	}

	return (
		<BookStoreContext value={storeRef.current}>
			{children}
		</BookStoreContext>
	);
}

/**
 * 更加推荐的用法：支持 selector，避免不必要的重渲染
 */
export function useBookStore<T>(selector: (state: BookStoreState) => T): T {
	const context = use(BookStoreContext);
	if (!context) {
		throw new Error('useBookStore must be used within a BookStoreProvider');
	}
	return useStore(context, selector);
}
