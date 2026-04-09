import { Header } from './_components/header';
import { getBooks } from '@/lib/book';
import { DashboardStoreProvider, InitialState } from './_store/store';
import { DashboardContainer } from './_components/dashboard-container';
import { getArticles } from '@/lib/article';

type Props = {
	searchParams: Promise<{
		view?: string;
	}>;
};

/**
 * 仪表盘主页：这是一个异步的服务端组件 (Server Component)
 */
export default async function DashboardPage({
	searchParams,
}: Props) {
	// 1. 服务端预取数据与参数
	const initialBooks = await getBooks();
	const initialArticles = await getArticles();
	const { view = 'books' } = await searchParams;

	return (
		<DashboardStoreProvider
			initialState={{
				view,
				books: initialBooks,
				articles: initialArticles
			} as InitialState}
		>
			<div className="min-h-screen bg-base-200 flex flex-col">
				{/* 整体导航区域 (客户端控制 URL) */}
				<Header />

				{/* 列表与交互区域 (根据 Store 显隐) */}
				<DashboardContainer />
			</div>
		</DashboardStoreProvider>
	);
}

