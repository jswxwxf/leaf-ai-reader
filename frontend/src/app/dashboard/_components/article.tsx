import { ExternalLink, Globe, Loader2, AlertCircle } from 'lucide-react';

interface Props {
	article: {
		id: number;
		title: string;
		source: string;
		url: string;
		status?: 'ready' | 'processing' | 'error';
	};
}

/**
 * Article (文章简项组件)
 * 职责：展示单篇文章的卡片 UI，支持加载中/就绪/错误状态。
 */
export function Article({ article }: Props) {
	const status = article.status || 'ready';

	return (
		<div
			className={`group bg-base-100 rounded-xl p-4 shadow-sm border border-base-200 transition-all flex items-center gap-4 ${status === 'ready' ? 'hover:border-primary/30 hover:shadow-md cursor-pointer' : 'cursor-default'
				}`}
		>
			{/* 图标/封面区域 */}
			<div className="w-12 h-12 rounded-lg bg-base-200 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
				{status === 'processing' ? (
					<Loader2 className="w-6 h-6 text-primary animate-spin" />
				) : status === 'error' ? (
					<AlertCircle className="w-6 h-6 text-error opacity-60" />
				) : (
					<Globe className="w-6 h-6 opacity-30 group-hover:text-primary group-hover:opacity-100" />
				)}
			</div>

			{/* 内容区 */}
			<div className="flex-1 min-w-0">
				<h3 className={`font-bold text-base md:text-lg truncate transition-colors ${status === 'ready' ? 'group-hover:text-primary' : 'opacity-60'
					}`}>
					{status === 'processing' ? '正在解析文章内容...' : article.title}
				</h3>
				<div className="flex items-center gap-2 mt-1">
					{status !== 'processing' && (
						<span className="badge badge-ghost badge-sm opacity-70 px-2 py-0.5">{article.source}</span>
					)}
					{status === 'processing' && (
						<span className="text-[11px] text-primary animate-pulse font-medium">请稍候...</span>
					)}
					{status === 'error' && (
						<span className="text-[11px] text-error font-medium">解析失败</span>
					)}
				</div>
			</div>

			{/* 功能按钮 */}
			<div className="shrink-0">
				{status === 'ready' ? (
					<button className="btn btn-ghost btn-circle btn-sm opacity-0 group-hover:opacity-100 transition-opacity">
						<ExternalLink className="w-4 h-4" />
					</button>
				) : (
					<div className="w-8 h-8 flex items-center justify-center opacity-20">
						<ExternalLink className="w-4 h-4" />
					</div>
				)}
			</div>
		</div>
	);
}
