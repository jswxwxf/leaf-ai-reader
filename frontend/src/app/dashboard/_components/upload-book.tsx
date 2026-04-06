import { Plus } from 'lucide-react';

interface Props {
	variant?: 'hero' | 'compact';
	onClick?: () => void;
}

/**
 * 上传图书卡片组件
 * 支持两种变体：
 * - hero: 用于空状态下的巨型居中卡片
 * - compact: 用于列表状态下展示在图书列表前面的紧凑型卡片
 */
export function UploadBook({ variant = 'compact', onClick }: Props) {
	if (variant === 'hero') {
		return (
			<div
				onClick={onClick}
				className="card bg-base-100 border-2 border-dashed border-base-300 hover:border-primary transition-all cursor-pointer group p-12 w-full max-w-md text-center shadow-sm hover:shadow-md"
			>
				<div className="flex flex-col items-center gap-4 text-base-content/50 group-hover:text-primary">
					<div className="bg-base-200 p-6 rounded-full group-hover:bg-primary/10 transition-colors">
						<Plus className="w-12 h-12" />
					</div>
					<div>
						<h3 className="font-bold text-lg text-base-content">开始你的阅读之旅</h3>
						<p className="text-sm opacity-60 mt-2">上传你的第一本 EPUB 图书</p>
					</div>
					<button className="btn btn-primary mt-4 px-8">立即上传</button>
				</div>
			</div>
		);
	}

	return (
		<div
			onClick={onClick}
			className="card bg-base-100 border-2 border-dashed border-base-300 hover:border-primary transition-colors cursor-pointer group flex flex-row items-center justify-center p-6 gap-4 min-h-[180px]"
		>
			<div className="flex flex-col items-center gap-2 text-base-content/50 group-hover:text-primary">
				<Plus className="w-8 h-8" />
				<span className="font-medium text-sm">上传新图书</span>
			</div>
		</div>
	);
}
