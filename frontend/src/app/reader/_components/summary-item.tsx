"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { type AISummary } from "../_store/store";

interface Props {
  item: AISummary;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

/**
 * 单个摘要项组件，负责展示、删除入口和自身的自动滚动逻辑。
 */
export function SummaryItem({ item, isActive, onClick, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [isActive]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`group card relative w-full snap-center cursor-pointer transition-all duration-300 border ${isActive
        ? "bg-primary/10 border-primary shadow-md translate-x-1"
        : "bg-base-200 border-base-300/50 hover:border-base-300 hover:bg-base-200/80"
        }`}
    >
      <button
        type="button"
        className="absolute -right-1.5 -top-1.5 z-20 btn btn-circle btn-xs btn-error opacity-70 lg:opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-sm border-none"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDelete();
        }}
        title="删除摘要"
      >
        <X className="w-3 h-3 text-white" />
        <span className="absolute inset-[-12px] pointer-fine:hidden" aria-hidden="true" />
      </button>
      <div className="p-3">
        <p className={`text-sm leading-relaxed transition-colors ${isActive ? "text-primary font-medium" : "opacity-80 font-normal"
          }`}>
          {item.summary}
        </p>
      </div>
    </div>
  );
}
