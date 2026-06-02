'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { type AISummary, useReaderStore } from '../_store/store';
import { useShallow } from 'zustand/react/shallow';
import { type BookData } from '@/lib/book';
import { request } from '@/lib/request';

interface ChapterResponse {
  status: string;
  content?: string;
  summary?: AISummary[] | null;
}

interface CachedChapter {
  content: string;
  summary: AISummary[];
}

const MAX_CACHED_CHAPTERS = 5;
const chapterCache = new Map<string, CachedChapter>();

const getCachedChapter = (key: string) => {
  const cachedChapter = chapterCache.get(key);
  if (!cachedChapter) return null;

  chapterCache.delete(key);
  chapterCache.set(key, cachedChapter);
  return cachedChapter;
};

const rememberChapter = (key: string, chapter: CachedChapter) => {
  chapterCache.delete(key);
  chapterCache.set(key, chapter);

  while (chapterCache.size > MAX_CACHED_CHAPTERS) {
    const oldestKey = chapterCache.keys().next().value;
    if (!oldestKey) break;
    chapterCache.delete(oldestKey);
  }
};

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
    const cachedChapter = getCachedChapter(currentCacheKey);

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
    request(
      `/api/books/${bookId}/progress`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark: path, progress }),
      },
      { silent: true },
    ).catch((err) => {
      console.error('[Helper] Failed to update book progress:', err);
    });
  }, [bookId, path, flattenChapters]);
}

function useCacheChapter({
  bookId,
  path,
  content,
  summaries,
}: {
  bookId: string | null;
  path: string | null;
  content: string;
  summaries: AISummary[];
}) {
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bookId || !path) return;

    const normalizedPath = normalizePath(path);
    if (lastPathRef.current !== normalizedPath) {
      lastPathRef.current = normalizedPath;
      return;
    }

    if (!content) return;

    rememberChapter(getChapterCacheKey(bookId, path), {
      content,
      summary: summaries,
    });
  }, [bookId, path, content, summaries]);
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
        if (getCachedChapter(nextCacheKey)) return;

        const res = await request<ChapterResponse>(
          `/api/books/${bookId}/chapters/${encodeURIComponent(nextChapter.path)}`,
          undefined,
          { silent: true },
        );

        if (res.content) {
          rememberChapter(nextCacheKey, {
            content: res.content,
            summary: res.summary || [],
          });
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

  const {
    data,
    content,
    summaries,
    setPath,
    setContent,
    setSummaries,
    setIsContentLoading,
  } = useReaderStore(
    useShallow((state) => ({
      data: state.data,
      content: state.content,
      summaries: state.summaries,
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
  useCacheChapter({
    bookId: bookIdFromUrl,
    path: pathFromUrl,
    content,
    summaries,
  });
  usePrefetchChapter({
    bookId: bookIdFromUrl,
    path: pathFromUrl,
    flattenChapters,
  });
  useBookProgress({
    bookId: bookIdFromUrl,
    path: pathFromUrl,
    flattenChapters,
  });

  return null;
}
