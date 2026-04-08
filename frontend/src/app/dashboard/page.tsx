import { BookShelf } from './_components/book-shelf';
import { Header } from './_components/header';
import { getBooks } from '@/lib/book';
import { BookStoreProvider } from './_store/book-store';

/**
 * 仪表盘主页：这是一个异步的服务端组件 (Server Component)
 */
export default async function DashboardPage() {
	// 1. 服务端预取数据
	const initialBooks = await getBooks();

	return (
		<BookStoreProvider initialBooks={initialBooks}>
			<div className="min-h-screen bg-base-200 flex flex-col">
				{/* 整体导航区域 (服务端渲染) */}
				<Header />

				{/* 列表与交互区域 (客户端注水) */}
				<BookShelf />
			</div>
		</BookStoreProvider>
	);
}

