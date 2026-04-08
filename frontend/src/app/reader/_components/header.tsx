"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 阅读器顶部状态栏组件
 */
export function Header() {
  const router = useRouter();

  return (
    <header className="navbar bg-base-200 border-b border-base-300 px-4 h-14 flex-none">
      <div className="flex-none">
        <button
          className="btn btn-ghost btn-circle"
          onClick={() => router.back()}
          title="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 px-4">
        <h1 className="text-lg font-bold truncate">
          书籍名称
        </h1>
      </div>
    </header>
  );
}
