import { useRouter } from 'next/navigation';
import { ExternalLink, Globe, Loader2, AlertCircle, X } from 'lucide-react';
import { ArticleData, deleteArticle } from '@/lib/article';
import { useDashboardStore } from '../_store/store';
import { showLoading, hideLoading } from '@/app/full-screen-loading';
import { showAlert, showConfirm } from '@/app/global-modals';

interface Props {
	article: ArticleData;
}

/**
 * Article (文章简项组件)
 * 职责：展示单篇文章的卡片 UI，支持加载中/就绪/错误状态。
 */
export function Article({ article }: Props) {
	const router = useRouter();
	const fetchArticles = useDashboardStore((s) => s.fetchArticles);
	const status = article.status || 'ready';

	const handleCardClick = () => {
		if (status === 'ready') {
			router.push(`/reader?article_id=${article.id}`);
		}
	};

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		await showConfirm({
			message: `确定要删除文章《${article.title}》吗？`,
		});

		try {
			showLoading();
			await deleteArticle(article.id);
			await fetchArticles();
		} catch (error) {
			showAlert({
				message: '删除失败，请稍后重试',
			});
			console.error('[Article handleDelete Error]', error);
		} finally {
			hideLoading();
		}
	};

	return (
		<div
			onClick={handleCardClick}
			className={`group bg-base-100 rounded-xl p-4 shadow-sm border border-base-200 transition-all flex items-center gap-4 relative ${status === 'ready' ? 'hover:border-primary/30 hover:shadow-md active:scale-[0.98] active:bg-base-200 cursor-pointer' : 'cursor-default'
				} ${status === 'processing' ? 'pointer-events-none' : ''}`}
		>
			{/* 删除按钮 (仅在悬停时显示) */}
			{status !== 'processing' && (
				<button
					className="absolute -top-1.5 -right-1.5 z-20 btn btn-circle btn-xs btn-error opacity-70 lg:opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-sm border-none"
					onClick={handleDelete}
					title="删除文章"
				>
					<X className="w-3 h-3 text-white" />
					{/* 移动端点击区域扩充层：确保小按钮在手机上也能轻松点中 */}
					<span className="absolute inset-[-12px]" aria-hidden="true" />
				</button>
			)}

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
						<div className="flex items-center text-[11px] opacity-70">
							<span className="max-w-[100px] truncate">{article.source || '未知来源'}</span>
							<span className="mx-1 opacity-20">|</span>
							<a
								href={article.source_url}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(e) => e.stopPropagation()}
								className="font-medium hover:text-primary hover:underline transition-colors"
								title="在新窗口打开原站"
							>
								跳转原站
							</a>
						</div>
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
					<div className="btn btn-ghost btn-circle btn-sm opacity-0 group-hover:opacity-100 transition-opacity">
						<ExternalLink className="w-4 h-4" />
					</div>
				) : (
					<div className="w-8 h-8 flex items-center justify-center opacity-20">
						<ExternalLink className="w-4 h-4" />
					</div>
				)}
			</div>
		</div>
	);
}
