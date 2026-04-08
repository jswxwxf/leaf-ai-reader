import { ChevronLeft, Play, ChevronRight } from "lucide-react";

/**
 * 阅读器底部控制栏组件
 */
export function Footer() {
  return (
    <footer className="h-20 bg-base-200 border-t border-base-300 px-4 flex flex-none items-center justify-center">
      <div className="flex items-center gap-4">
        <button className="btn btn-circle btn-ghost" title="上一句">
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button className="btn btn-circle btn-primary btn-lg shadow-lg" title="读此句">
          <Play className="w-6 h-6 fill-current" />
        </button>

        <button className="btn btn-circle btn-ghost" title="下一句">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </footer>
  );
}
