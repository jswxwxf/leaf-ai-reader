import { Star } from "lucide-react";

/**
 * 重点列表组件 (AI 核心摘要)
 */
export function Highlights() {
  return (
    <aside className="w-80 border-l border-base-300 bg-base-100 hidden lg:flex flex-col h-full overflow-hidden">
      <div className="p-4 flex-none border-b border-base-200">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> AI 核心摘要
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        <div className="card bg-base-200 shadow-sm border border-base-300/50">
          <div className="p-3">
            <p className="text-sm opacity-80 leading-relaxed">处于人生转折点的青年，探索智慧的先行者。</p>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm border border-base-300/50">
          <div className="p-3">
            <p className="text-sm opacity-80 leading-relaxed">名为“叶子”的星球，拥有发光的树木和古老的智慧。</p>
          </div>
        </div>
        <div className="card bg-primary/10 text-primary border border-primary/20 shadow-sm">
          <div className="p-3">
            <p className="text-sm font-medium leading-relaxed">章节核心冲突在于“宁静即将被打破”，暗示了即将到来的挑战。</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
