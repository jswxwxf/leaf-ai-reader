'use client';

import React, { createContext, useContext, useRef } from 'react';
import { createStore, useStore } from 'zustand';
import { BookData } from '@/lib/book';
import { request } from '@/lib/request';

interface BookState {
	books: BookData[];
	isLoading: boolean;
	setBooks: (books: BookData[]) => void;
	fetchBooks: () => Promise<void>;
}

export type BookStore = ReturnType<typeof createBookStore>;

const createBookStore = (initialBooks: BookData[] = []) => {
	return createStore<BookState>((set) => ({
		books: initialBooks,
		isLoading: false,
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
	}));
};

const BookStoreContext = createContext<BookStore | null>(null);

type Props = {
	initialBooks?: BookData[];
};

export function BookStoreProvider({
	children,
	initialBooks = []
}: React.PropsWithChildren<Props>) {
	const storeRef = useRef<BookStore>(null);
	if (!storeRef.current) {
		storeRef.current = createBookStore(initialBooks);
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
	const context = useContext(BookStoreContext);
	if (!context) {
		throw new Error('useBookStore must be used within a BookStoreProvider');
	}
	return useStore(context, selector);
}


