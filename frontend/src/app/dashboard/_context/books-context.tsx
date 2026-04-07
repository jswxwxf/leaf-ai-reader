'use client';

import React, { createContext, use, useState, useCallback, PropsWithChildren } from 'react';
import { BookData } from '../_components/book';
import { request } from '@/lib/request';

interface BooksContextType {
	books: BookData[];
	isLoading: boolean;
	refreshBooks: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType | undefined>(undefined);

type Props = {
	initialBooks?: BookData[];
};

export function BooksProvider({
	children,
	initialBooks = []
}: PropsWithChildren<Props>) {
	const [books, setBooks] = useState<BookData[]>(initialBooks);
	const [isLoading, setIsLoading] = useState(false);

	const refreshBooks = useCallback(async () => {
		setIsLoading(true);
		try {
			const res = await request<{ books: BookData[] }>('/api/books');
			setBooks(res.books);
		} catch (error) {
			console.error('[BooksContext] Failed to refresh books:', error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	return (
		<BooksContext value={{ books, isLoading, refreshBooks }}>
			{children}
		</BooksContext>
	);
}

export function useBooks() {
	const context = use(BooksContext);
	if (context === undefined) {
		throw new Error('useBooks must be used within a BooksProvider');
	}
	return context;
}
