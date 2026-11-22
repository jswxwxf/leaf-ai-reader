'use client';

import { useEffect, useRef } from 'react';
import { redirect, useSearchParams } from 'next/navigation';
import { type AISummary, useReaderStore, useReaderStoreRaw } from '../_store/store';
import { useShallow } from 'zustand/react/shallow';
import type { BookData } from '@/lib/book';
import { request } from '@/lib/request';
import { useReader } from '../_hooks/use-reader';
import { debounce } from '../_utils/utils';

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

interface BookBookmark {
  active_chapter: string;
  start_sId?: string;
}

function parseBookBookmark(value?: string | null): BookBookmark | null {
  if (!value?.trim()) return null;
  // 旧书签就是章节路径，新书签还可以包含该章的句子 ID。
  if (!value.trimStart().startsWith('{')) return { active_chapter: value };

  try {
    const bookmark = JSON.parse(value);
    if (typeof bookmark?.active_chapter !== 'string' || !bookmark.active_chapter.trim()) return null;
    const start_sId = typeof bookmark.start_sId === 'string' && /^s-\d+$/.test(bookmark.start_sId)
      ? bookmark.start_sId
      : undefined;
    return { active_chapter: bookmark.active_chapter, start_sId };
  } catch {
    return null;
  }
}

function useResolveChapter(bookData: BookData | null, bookmark: BookBookmark | null) {
  const searchParams = useSearchParams();
  const bookIdFromUrl = searchParams.get('book_id');
  const pathFromUrl = searchParams.get('path');
  const sentenceId = searchParams.get('sentence_id');

  // 书架入口没有指定章节。优先打开有效的书签章节，否则打开第一章。
  if (bookIdFromUrl && bookData && !pathFromUrl) {
    const flattenChapters = bookData.flattenChapters || [];
    const savedChapter = bookmark && flattenChapters.find(
      (chapter) => normalizePath(chapter.path) === normalizePath(bookmark.active_chapter),
    );
    const targetPath = savedChapter?.path || flattenChapters[0]?.path;
    if (targetPath) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('path', targetPath);
      if (!sentenceId && savedChapter && bookmark?.start_sId) {
        params.set('sentence_id', bookmark.start_sId);
      }
      redirect(`/reader?${params}`);
    }
  }

  return searchParams;
}

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

function saveBookProgress(bookId: string, bookmark: string, progress: number) {
  return request(
    `/api/books/${bookId}/progress`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmark, progress }),
    },
    { silent: true },
  ).catch((err) => {
    console.error('[Helper] Failed to update book progress:', err);
  });
}

function useBookProgress({
  bookId,
  path,
  flattenChapters,
  bookmark,
}: {
  bookId: string | null;
  path: string | null;
  flattenChapters: FlattenChapters;
  bookmark: BookBookmark | null;
}) {
  const withSentenceBookmark = bookmark?.start_sId ? bookmark.active_chapter : undefined;
  const store = useReaderStoreRaw();
  const normalizedPath = path && normalizePath(path);
  const index = flattenChapters.findIndex((chapter) => normalizePath(chapter.path) === normalizedPath);
  const progress = index === -1 ? null : Math.floor(((index + 1) / flattenChapters.length) * 100);

  useEffect(() => {
    if (!bookId || !path || progress === null) return;

    // 进章请求只保存章节路径。重开已有句子书签的章节时，跳过写入以保留句子 ID。
    if (withSentenceBookmark && normalizePath(withSentenceBookmark) === normalizedPath) return;

    void saveBookProgress(bookId, path, progress);
  }, [bookId, path, normalizedPath, progress, withSentenceBookmark]);

  useEffect(() => {
    if (!bookId || !path || progress === null) return;

    const saveSentence = debounce((sentenceId: string) => {
      const bookmark: BookBookmark = { active_chapter: path, start_sId: sentenceId };
      void saveBookProgress(bookId, JSON.stringify(bookmark), progress);
    }, 2000);

    let lastSentenceId: string | null = null;
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.mode !== 'book' || state.path !== path || state.isContentLoading) {
        saveSentence.cancel();
        lastSentenceId = null;
        return;
      }

      // 点击或朗读更新正文句子，滚动更新摘要锚点。只使用本次变化的 ID，避免被旧高亮覆盖。
      const speechId = state.speechSentenceId !== previous.speechSentenceId ? state.speechSentenceId : null;
      const summaryId = state.summarySentenceId !== previous.summarySentenceId ? state.summarySentenceId : null;
      const sentenceId = speechId ?? summaryId;
      if (!sentenceId || sentenceId === lastSentenceId) return;

      lastSentenceId = sentenceId;
      saveSentence(sentenceId);
    });

    return () => {
      unsubscribe();
      saveSentence.cancel();
    };
  }, [bookId, path, progress, store]);
}

/**
 * 正文加载后按 URL 中的 sentence_id 定位并高亮原文。
 * 从书签打开图书和通过链接直达句子共用这里的定位流程。
 */
function useBookSentenceMark(
  searchParams: ReturnType<typeof useSearchParams>,
) {
  const bookIdFromUrl = searchParams.get('book_id');
  const pathFromUrl = searchParams.get('path');
  const sentenceId = searchParams.get('sentence_id');
  const lastTarget = useRef<string | null>(null);
  const { jumpToSentence } = useReader();
  const { content, path, contentRef, isContentLoading } = useReaderStore(
    useShallow((state) => ({
      content: state.content,
      path: state.path,
      contentRef: state.contentRef,
      isContentLoading: state.isContentLoading,
    })),
  );

  useEffect(() => {
    // 只接受正文使用的 s-数字 格式。参数移除后清空记录，之后可再次打开同一目标。
    if (!sentenceId || !/^s-\d+$/.test(sentenceId)) {
      lastTarget.current = null;
      return;
    }
    // EPUB 切章时 URL 可能先更新，Store 中暂时还是上一章。等章节匹配、正文加载完成再查找。
    if (!content || isContentLoading || (bookIdFromUrl && path !== pathFromUrl)) return;

    // 不同书籍和章节都可能有同一个 s-42，因此用书籍、章节和句子 ID 一起识别目标。
    // 同一目标成功定位一次后，后续渲染无需再次滚动，读者可以继续向下阅读。
    const target = JSON.stringify([bookIdFromUrl, pathFromUrl, sentenceId]);
    if (lastTarget.current === target) return;
    // 只在当前阅读器的正文容器内查找，找到元素后才记录为已定位。
    const sentence = contentRef?.current?.querySelector(`[id="${sentenceId}"]`);
    if (!sentence) return;

    lastTarget.current = target;
    // 复用现有的句子高亮状态更新。这里直接将目标句滚到视口中央，省去打开链接时的平滑滚动动画。
    jumpToSentence(sentenceId, { scroll: false });
    sentence.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, [sentenceId, bookIdFromUrl, path, pathFromUrl, content, contentRef, isContentLoading, jumpToSentence]);

}

/**
 * 阅读器全局逻辑助手 (Helper)
 * 职责：
 * 1. 监听 URL 变化并同步到全局 Store
 * 2. 记录图书阅读进度
 * 3. 静默预读下一章正文到前端内存
 */
export function Helper() {
  const {
    bookData,
    content,
    summaries,
    setPath,
    setContent,
    setSummaries,
    setIsContentLoading,
  } = useReaderStore(
    useShallow((state) => ({
      bookData: state.mode === 'book' ? state.data as BookData | null : null,
      content: state.content,
      summaries: state.summaries,
      setPath: state.setPath,
      setContent: state.setContent,
      setSummaries: state.setSummaries,
      setIsContentLoading: state.setIsContentLoading,
    })),
  );

  const flattenChapters = bookData?.flattenChapters || [];
  const bookmark = parseBookBookmark(bookData?.bookmark);

  const searchParams = useResolveChapter(bookData, bookmark);
  const bookIdFromUrl = searchParams.get('book_id');
  const pathFromUrl = searchParams.get('path');

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
    bookmark,
  });
  
  useBookSentenceMark(searchParams);

  return null;
}
