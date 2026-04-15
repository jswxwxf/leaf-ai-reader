"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "../_store/store";
import { request } from "@/lib/request";
import type { Chapter, BookData } from "@/lib/book";

const Chapters = ({ items, bookId }: { items: Chapter[]; bookId: string }) => {
  return (
    <>
      {items.map((item, index) => (
        <li key={`${item.path}-${index}`}>
          {item.children && item.children.length > 0 ? (
            <details>
              <summary>
                {item.title}
              </summary>
              <ul>
                <Chapters items={item.children} bookId={bookId} />
              </ul>
            </details>
          ) : (
            <Link 
              href={`/reader?book_id=${bookId}&path=${item.path}`}
              className="cursor-pointer"
            >
              {item.title}
            </Link>
          )}
        </li>
      ))}
    </>
  );
};

/**
 * 阅读器章节目录侧边栏组件
 */
export function ChaptersWrapper() {
  const { data, setPath, setContent } = useReaderStore(
    useShallow((state) => ({
      data: state.data,
      setPath: state.setPath,
      setContent: state.setContent,
    }))
  );
  const searchParams = useSearchParams();

  // 从 URL 中获取当前的 path
  const pathFromUrl = searchParams.get("path");
  const bookId = (data as BookData)?.id;
  const chapters = (data as BookData)?.chapters || [];

  // 1. 同步 URL 状态到 Store
  useEffect(() => {
    if (pathFromUrl) {
      setPath(pathFromUrl);
    }
  }, [pathFromUrl, setPath]);

  // 2. 监听书籍 ID 和章节路径的变化加载内容
  useEffect(() => {
    if (!bookId || !pathFromUrl) return;

    const loadChapter = async () => {
      try {
        const result = await request<{ content?: string }>(`/api/books/${bookId}/chapters/${pathFromUrl}`);
        console.log("--- Chapter Loaded ---", result);

        if (result.content) {
          setContent(result.content);
        }
      } catch (error) {
        console.error("Error loading chapter:", error);
      }
    };

    loadChapter();
  }, [bookId, pathFromUrl, setContent]);

  if (!bookId) return null;

  return (
    <aside className="w-64 border-r border-base-300 bg-base-100 hidden md:flex flex-col h-full overflow-hidden">
      <div className="p-4 flex-none border-b border-base-200">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Menu className="w-4 h-4" /> 章节目录
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ul className="menu menu-sm bg-base-100 rounded-box w-full p-0">
          <Chapters items={chapters} bookId={bookId} />
        </ul>
      </div>
    </aside>
  );
}
