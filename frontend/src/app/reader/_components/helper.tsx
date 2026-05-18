'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { type AISummary, useReaderStore } from '../_store/store';
import { useShallow } from 'zustand/react/shallow';
import { type BookData, updateBookProgress } from '@/lib/book';
import { request } from '@/lib/request';

interface ChapterResponse {
  status: string;
  content?: string;
  summary?: AISummary[] | null;
}

let preloadedChapter: {
  key: string;
  content: string;
  summary: AISummary[];
} | null = null;

const normalizePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

const getChapterCacheKey = (bookId: string, path: string) =>
  `${bookId}::${normalizePath(path)}`;

type FlattenChapters = NonNullable<BookData['flattenChapters']>;

function useFetchChapter({
  bookId,
  path,
  setPath,
  setContent,
  setSummaries,
  setIsContentLoading,
}: {
  bookId: string | null;
  path: string | null;
  setPath: (path: string | null) => void;
  setContent: (content: string) => void;
  setSummaries: (summaries: AISummary[]) => void;
  setIsContentLoading: (isLoading: boolean) => void;
}) {
  useEffect(() => {
    if (!bookId || !path) return;

    const currentCacheKey = getChapterCacheKey(bookId, path);
    const cachedChapter =
      preloadedChapter?.key === currentCacheKey ? preloadedChapter : null;

    setPath(path);
    if (cachedChapter) {
      setContent(cachedChapter.content);
      setSummaries(cachedChapter.summary);
      setIsContentLoading(false);
    } else {
      setContent('');
      setSummaries([]);
      setIsContentLoading(true);
    }
  }, [bookId, path, setPath, setContent, setSummaries, setIsContentLoading]);
}

function useBookProgress({
  bookId,
  path,
  flattenChapters,
}: {
  bookId: string | null;
  path: string | null;
  flattenChapters: FlattenChapters;
}) {
  useEffect(() => {
    if (!bookId || !path || flattenChapters.length === 0) return;

    const index = flattenChapters.findIndex(
      (chapter) => normalizePath(chapter.path) === normalizePath(path),
    );
    if (index === -1) return;

    const progress = Math.floor(((index + 1) / flattenChapters.length) * 100);
    updateBookProgress(bookId, path, progress).catch((err) => {
      console.error('[Helper] Failed to update book progress:', err);
    });
  }, [bookId, path, flattenChapters]);
}

function usePrefetchChapter({
  bookId,
  path,
  flattenChapters,
}: {
  bookId: string | null;
  path: string | null;
  flattenChapters: FlattenChapters;
}) {
  useEffect(() => {
    if (!bookId || !path) return;

    const prefetchTimer = setTimeout(async () => {
      try {
        const index = flattenChapters.findIndex(
          (chapter) => normalizePath(chapter.path) === normalizePath(path),
        );
        if (index === -1) return;

        const nextChapter = flattenChapters[index + 1];
        if (!nextChapter) return;

        const nextCacheKey = getChapterCacheKey(bookId, nextChapter.path);
        if (preloadedChapter?.key === nextCacheKey) return;

        const res = await request<ChapterResponse>(
          `/api/books/${bookId}/chapters/${encodeURIComponent(nextChapter.path)}`,
          undefined,
          { silent: true },
        );

        if (res.content) {
          preloadedChapter = {
            key: nextCacheKey,
            content: res.content,
            summary: res.summary || [],
          };
        }
      } catch (err) {
        console.debug('[Helper] Failed to prefetch next chapter content:', err);
      }
    }, 1500);

    return () => clearTimeout(prefetchTimer);
  }, [bookId, path, flattenChapters]);
}

/**
 * 阅读器全局逻辑助手 (Helper)
 * 职责：
 * 1. 监听 URL 变化并同步到全局 Store
 * 2. 记录图书阅读进度
 * 3. 静默预读下一章正文到前端内存
 */
export function Helper() {
  const searchParams = useSearchParams();
  const bookIdFromUrl = searchParams.get('book_id');
  const pathFromUrl = searchParams.get('path');

  const { data, setPath, setContent, setSummaries, setIsContentLoading } =
    useReaderStore(
      useShallow((state) => ({
        data: state.data,
        setPath: state.setPath,
        setContent: state.setContent,
        setSummaries: state.setSummaries,
        setIsContentLoading: state.setIsContentLoading,
      })),
    );

  const bookData = data as BookData;
  const flattenChapters = bookData?.flattenChapters || [];

  useFetchChapter({
    bookId: bookIdFromUrl,
    path: pathFromUrl,
    setPath,
    setContent,
    setSummaries,
    setIsContentLoading,
  });
  useBookProgress({
    bookId: bookIdFromUrl,
    path: pathFromUrl,
    flattenChapters,
  });
  usePrefetchChapter({
    bookId: bookIdFromUrl,
    path: pathFromUrl,
    flattenChapters,
  });

  return null;
}
