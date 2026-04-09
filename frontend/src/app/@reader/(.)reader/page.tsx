"use client";

import { Reader } from "../../reader/_components/reader";

export default function ReaderInterceptPage() {
	return (
		<div className="fixed inset-0 z-40 bg-base-100 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
			{/* 拦截路由模式下，阅读器作为覆盖层出现 */}
			<Reader isPopup={true} />
		</div>
	);
}
