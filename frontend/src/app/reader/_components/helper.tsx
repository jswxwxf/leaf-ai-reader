"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { type Chapter, type BookData, updateBookProgress } from "@/lib/book";

/**
 * 阅读器全局逻辑助手 (Helper)
 * 职责：
 * 1. 监听 URL 变化并同步到全局 Store
 * 2. 处理书籍模式下的初始化章节自动跳转
 * 3. 其它需要单例并驻留在 Store 环境下的逻辑
 */
export function Helper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookIdFromUrl = searchParams.get("book_id");
  const pathFromUrl = searchParams.get("path");

  const {
    data,
    setPath,
    setContent,
    setSummaries,
    setIsContentLoading
  } = useReaderStore(
    useShallow((state) => ({
      data: state.data,
      setPath: state.setPath,
      setContent: state.setContent,
      setSummaries: state.setSummaries,
      setIsContentLoading: state.setIsContentLoading,
    }))
  );

  const bookData = data as BookData;
  const flattenChapters = bookData?.flattenChapters || [];
  const bookmark = bookData?.bookmark;

  // [逻辑 A] 自动归位：如果只打开了书籍但没有 path，自动定向到首章或上次阅读位置
  useEffect(() => {
    if (bookIdFromUrl && flattenChapters.length > 0 && !pathFromUrl) {
      // 优先从上次书签恢复，如果没有则跳第一章
      const targetPath = bookmark || flattenChapters[0].path;
      if (targetPath) {
        router.replace(`/reader?book_id=${bookIdFromUrl}&path=${encodeURIComponent(targetPath)}`);
      }
    }
  }, [bookIdFromUrl, flattenChapters, pathFromUrl, router, bookmark]);

  // [逻辑 B] 同步同步 URL 路径到 Store 并触发章节加载，同时记录进度
  useEffect(() => {
    if (pathFromUrl && bookIdFromUrl) {
      // 1. 同步到 Store 并显示加载中
      setPath(pathFromUrl);
      setContent("");
      setSummaries([]);
      setIsContentLoading(true);

      // 2. 根据当前章节在展平列表中的位置计算进度并保存
      if (flattenChapters.length > 0) {
        const index = flattenChapters.findIndex(
          (c) => decodeURIComponent(c.path) === decodeURIComponent(pathFromUrl)
        );
        if (index !== -1) {
          const progress = Math.floor(((index + 1) / flattenChapters.length) * 100);
          updateBookProgress(bookIdFromUrl, pathFromUrl, progress).catch(err => {
            console.error("[Helper] Failed to update book progress:", err);
          });
        }
      }
    }
  }, [pathFromUrl, bookIdFromUrl, flattenChapters, setPath, setContent, setSummaries, setIsContentLoading]);

  return null;
}
