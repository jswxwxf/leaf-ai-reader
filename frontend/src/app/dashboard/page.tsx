import { BookOpen } from 'lucide-react';
import { UserProfile } from './_components/user-profile';
import { UploadBook } from './_components/upload-book';

export default async function DashboardPage() {
	// 模拟数据：图书列表
	const dummyBooks = [
		{ id: 1, title: 'Getting Started with Next.js', author: 'Vercel Team' },
		{ id: 2, title: 'Cloudflare Workers Handbook', author: 'Cloudflare Engineering' },
		{ id: 3, title: 'AI-Powered Applications', author: 'OpenAI Devs' },
	];

	return (
		<div className="min-h-screen bg-base-200">
			{/* Header */}
			<header className="navbar bg-base-100 shadow-sm px-4 md:px-8">
				<div className="flex-1">
					<a className="text-xl font-bold flex items-center gap-2">
						<BookOpen className="w-6 h-6 text-primary" />
						Leaf AI Reader
					</a>
				</div>
				<div className="flex-none gap-4">
					<UserProfile />
				</div>
			</header>

			{/* Body */}
			<main className="p-4 md:p-6 w-full flex-1 flex flex-col">
				{dummyBooks.length === 0 ? (
					/* 空状态：居中显示上传按钮 */
					<div className="flex-1 flex items-center justify-center py-20">
						<UploadBook variant="hero" />
					</div>
				) : (
					/* 列表状态：Grid 布局 */
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
						{/* 第一项：上传新图书小卡片 */}
						<UploadBook variant="compact" />

						{/* 现有图书列表 */}
						{dummyBooks.map((book) => (
							<div key={book.id} className="card card-side bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden border border-base-200 group h-[180px]">
								<figure className="relative w-32 min-w-[128px] h-full bg-base-300">
									<img
										src={`https://picsum.photos/seed/${book.id + 10}/400/600`}
										alt={book.title}
										className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
									/>
								</figure>
								<div className="card-body p-4 justify-center">
									<h2 className="font-semibold text-sm line-clamp-2 leading-snug">{book.title}</h2>
									<p className="text-xs opacity-50 mt-1 truncate">{book.author}</p>
								</div>
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
