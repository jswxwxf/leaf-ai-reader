"use client";

import { ArrowLeft, Menu } from "lucide-react";
import { useReaderStore } from "../_store/store";
import { useShallow } from "zustand/react/shallow";

interface Props {
	isPopup?: boolean;
}

/**
 * 阅读器顶部状态栏组件
 */
export function Header({ isPopup = true }: Props) {
	const { data, mode, setChaptersOpen } = useReaderStore(
		useShallow((state) => ({
			data: state.data,
			mode: state.mode,
			setChaptersOpen: state.setChaptersOpen,
		}))
	);

	const isBookMode = mode === 'book';

	return (
		<header className="navbar bg-base-200 border-b border-base-300 px-4 h-14 flex-none gap-2">
			<div className="flex-none flex items-center gap-1">
				{/* 只有在弹窗/拦截路由模式下才显示返回按钮 */}
				{isPopup && (
					<button
						className="btn btn-ghost btn-circle active:scale-90 transition-all font-bold"
						title="返回"
						onClick={() => {
							// 主动停止朗读，并强制映射返回仪表盘
							window.speechSynthesis.cancel();
							window.location.href = '/dashboard';
						}}
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
				)}

				{/* 移动端目录切换按钮：常驻，只要是书籍模式就显示 */}
				{isBookMode && (
					<button
						className="btn btn-ghost btn-circle md:hidden active:scale-90 transition-all"
						onClick={() => setChaptersOpen(true)}
						title="打开目录"
					>
						<Menu className="w-5 h-5" />
					</button>
				)}
			</div>
			<div className="flex-1 px-2 min-w-0 text-center md:text-left">
				<h1 className="text-lg font-bold truncate">
					{data?.title || "正在加载..."}
				</h1>
			</div>
		</header>
	);
}
