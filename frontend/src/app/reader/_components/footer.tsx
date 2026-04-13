'use client';

import { Speecher } from "./speecher";

/**
 * 阅读器底部控制栏组件
 */
export function Footer() {
  return (
    <footer className="h-20 bg-base-200 border-t border-base-300 px-4 flex flex-none items-center justify-center">
      <Speecher />
    </footer>
  );
}
