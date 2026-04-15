"use client";

import { Menu } from "lucide-react";
import { useReaderStore } from "../_store/store";
import type { Chapter, BookData } from "@/lib/book";

const Chapters = ({ items }: { items: Chapter[] }) => {
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
                <Chapters items={item.children} />
              </ul>
            </details>
          ) : (
            <a>
              {item.title}
            </a>
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
  const data = useReaderStore((state) => state.data);
  const chapters = (data as BookData)?.chapters || [];

  return (
    <aside className="w-64 border-r border-base-300 bg-base-100 hidden md:flex flex-col h-full overflow-hidden">
      <div className="p-4 flex-none border-b border-base-200">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Menu className="w-4 h-4" /> 章节目录
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ul className="menu menu-sm bg-base-100 rounded-box w-full p-0">
          <Chapters items={chapters} />
        </ul>
      </div>
    </aside>
  );
}
