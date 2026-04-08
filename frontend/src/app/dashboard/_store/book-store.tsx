'use client';

import React, { createContext, useRef, use } from 'react';
import { createStore, useStore } from 'zustand';
import { BookData } from '@/lib/book';
import { request } from '@/lib/request';

export interface BookState {
	books: BookData[];
	isLoading: boolean;
	view: 'books' | 'articles'; // 当前视图：图书或文章
	setBooks: (books: BookData[]) => void;
	fetchBooks: () => Promise<void>;
	setView: (view: 'books' | 'articles') => void;
}

export type InitialState = Partial<Pick<BookState, 'books' | 'view'>>;

const createBookStore = (initialState: InitialState = {}) => {
	const { books = [], view = 'books' } = initialState;
	return createStore<BookState>((set) => ({
		books,
		isLoading: false,
		view,
		setBooks: (books) => set({ books }),
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
		setView: (view) => set({ view }),
	}));
};

export type BookStore = ReturnType<typeof createBookStore>;

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
export function useBookStore<T>(selector: (state: BookState) => T): T {
	const context = use(BookStoreContext);
	if (!context) {
		throw new Error('useBookStore must be used within a BookStoreProvider');
	}
	return useStore(context, selector);
}
