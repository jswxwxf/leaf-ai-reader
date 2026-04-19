"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";
import { type BookData, updateBookProgress } from "@/lib/book";
import { request } from "@/lib/request";

/**
 * 阅读器全局逻辑助手 (Helper)
 * 职责：
 * 1. 监听 URL 变化并同步到全局 Store
 * 2. 其它需要单例并驻留在 Store 环境下的逻辑
 */
export function Helper() {
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

  // 同步同步 URL 路径到 Store 并触发章节加载，同时记录进度
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

      // 3. 异步静默预取邻居章节 (前后各 2 章)
      // 使用 setTimeout 稍微延迟，避免抢占当前章节的加载带宽
      setTimeout(() => {
        const index = flattenChapters.findIndex(
          (c) => decodeURIComponent(c.path) === decodeURIComponent(pathFromUrl)
        );
        if (index === -1) return;

        const neighbors = [index - 1, index - 2, index + 1, index + 2];
        neighbors.forEach(idx => {
          if (idx >= 0 && idx < flattenChapters.length) {
            const neighbor = flattenChapters[idx];
            // 使用极简请求且开启 silent 模式，仅触发后端处理而不弹出 alert
            request(`/api/books/${bookIdFromUrl}/chapters/${encodeURIComponent(neighbor.path)}?prefetch=1`, undefined, { silent: true });
          }
        });
      }, 1000);
    }
  }, [pathFromUrl, bookIdFromUrl, flattenChapters, setPath, setContent, setSummaries, setIsContentLoading]);

  return null;
}
