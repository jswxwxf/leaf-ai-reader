"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { type ArticleData } from "@/lib/article";
import { type BookData } from "@/lib/book";

interface Props {
	isPopup?: boolean;
	data?: ArticleData | BookData | null;
}

/**
 * 阅读器顶部状态栏组件
 */
export function Header({ isPopup = true, data }: Props) {
	const router = useRouter();

	return (
		<header className="navbar bg-base-200 border-b border-base-300 px-4 h-14 flex-none">
			{isPopup && (
				<div className="flex-none">
					<button
						className="btn btn-ghost btn-circle active:scale-90 transition-all"
						onClick={() => router.back()}
						title="返回"
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
				</div>
			)}
			<div className="flex-1 px-4 min-w-0">
				<h1 className="text-lg font-bold truncate">
					{data?.title || "正在加载..."}
				</h1>
			</div>
		</header>
	);
}
