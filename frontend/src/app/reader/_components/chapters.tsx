"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useReaderStore } from "../_store/store";
import type { Chapter, BookData } from "@/lib/book";
import { usePolling } from "../../dashboard/_hooks/use-polling";

/**
 * 递归检查某个章节及其所有子章节中是否有选中的项
 */
const hasActiveChild = (items: Chapter[], targetPath: string): boolean => {
  return items.some(item =>
    item.path === targetPath ||
    (item.children && item.children.length > 0 && hasActiveChild(item.children, targetPath))
  );
};

const Chapters = ({
  items,
  bookId,
  path
}: {
  items: Chapter[];
  bookId: string;
  path: string | null;
}) => {
  const setChaptersOpen = useReaderStore((state) => state.setChaptersOpen);

  return (
    <>
      {items.map((item, index) => {
        const isActive = path === item.path;
        const hasChildren = item.children && item.children.length > 0;
        // 如果子节点中有活跃项，则展开当前目录
        const shouldOpen = hasChildren && path && hasActiveChild(item.children!, path);

        return (
          <li key={`${item.path}-${index}`}>
            {hasChildren ? (
              <details open={!!shouldOpen}>
                <summary className={isActive ? "text-primary font-medium" : ""}>
                  {item.title}
                </summary>
                <ul>
                  <Chapters items={item.children!} bookId={bookId} path={path} />
                </ul>
              </details>
            ) : (
              <Link
                href={`/reader?book_id=${bookId}&path=${encodeURIComponent(item.path)}`}
                className={`cursor-pointer ${isActive ? "bg-primary/10 text-primary font-medium" : ""}`}
                onClick={() => setChaptersOpen(false)}
                ref={(el) => {
                  if (isActive && el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
              >
                {item.title}
              </Link>
            )}
          </li>
        );
      })}
    </>
  );
};

/**
 * 阅读器章节目录侧边栏组件
 */
export function ChaptersWrapper() {
  const { data, isContentLoading, setPath, setContent, setIsContentLoading, fetchBookChapter } = useReaderStore(
    useShallow((state) => ({
      data: state.data,
      isContentLoading: state.isContentLoading,
      setPath: state.setPath,
      setContent: state.setContent,
      setIsContentLoading: state.setIsContentLoading,
      fetchBookChapter: state.fetchBookChapter,
    }))
  );
  const searchParams = useSearchParams();

  // 从 URL 中获取当前的 path
  const pathFromUrl = searchParams.get("path");
  const bookId = (data as BookData)?.id;
  const chapters = (data as BookData)?.chapters || [];

  // 用于在 fetchData 没改变 Store 时（如处理中）强制触发组件重渲染，从而维持 usePolling 的后续计时
  const [pollTick, setPollTick] = useState(0);

  // 1. 同步 URL 状态到 Store 并重置内容（触发加载态）
  useEffect(() => {
    if (pathFromUrl) {
      setPath(pathFromUrl);
      setContent(""); // 切换章节时先清空
      setIsContentLoading(true); // 开启加载状态
    }
  }, [pathFromUrl, setPath, setContent, setIsContentLoading]);

  // 2. 挂载轮询逻辑
  const pollItems = [{ status: isContentLoading ? 'processing' : 'ready' }];

  usePolling(
    pollItems,
    async () => {
      if (bookId && pathFromUrl) {
        await fetchBookChapter(bookId, pathFromUrl);
        setPollTick(t => t + 1);
      }
    }
  );

  if (!bookId) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base-100 border-r border-base-300">
      <div className="p-4 flex-none border-b border-base-200">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Menu className="w-4 h-4" /> 章节目录
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ul className="menu menu-sm bg-base-100 rounded-box w-full p-0">
          <Chapters items={chapters} bookId={bookId} path={pathFromUrl} />
        </ul>
      </div>
    </div>
  );
}

/**
 * 移动端目录抽屉
 */
export function MobileChaptersDrawer() {
  const { isChaptersOpen, setChaptersOpen } = useReaderStore(
    useShallow((state) => ({
      isChaptersOpen: state.isChaptersOpen,
      setChaptersOpen: state.setChaptersOpen,
    }))
  );

  if (!isChaptersOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => setChaptersOpen(false)}
      />
      
      {/* 抽屉内容 */}
      <div className="absolute inset-y-0 left-0 w-80 max-w-[85%] shadow-2xl animate-in slide-in-from-left duration-300">
        <ChaptersWrapper />
      </div>
    </div>
  );
}
