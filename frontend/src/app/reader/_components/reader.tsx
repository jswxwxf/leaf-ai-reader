import { Header } from "./header";
import { ChaptersWrapper, MobileChaptersDrawer } from "./chapters";
import { Content } from "./content";
import { Summary } from "./summary";
import { Footer } from "./footer";
import { ReaderStoreProvider } from "../_store/store";
import { getArticle, getArticleData, type ArticleData } from "@/lib/article";
import { getBookData, getBookChapters, type BookData } from "@/lib/book";

interface Props {
	isPopup?: boolean;
	article_id?: string | null;
	book_id?: string | null;
}

/**
 * 阅读器主框架组件
 * 作为一个服务器组件，它负责承载 StoreProvider 并将初始参数下发给客户端状态机
 */
export async function Reader({ isPopup = true, article_id, book_id }: Props) {
	let data: ArticleData | BookData | null = null;
	if (article_id) {
		data = await getArticleData(article_id);
	} else if (book_id) {
		const [bookData, chapters] = await Promise.all([
			getBookData(book_id),
			getBookChapters(book_id)
		]);

		if (bookData) {
			bookData.chapters = chapters;
			data = bookData;
		}
	}

	if (!data) {
		return (
			<div className="flex flex-col items-center justify-center h-screen bg-base-100 text-base-content/60">
				<div className="text-xl font-medium mb-2">数据加载失败</div>
				<p className="text-sm">文章不存在或链路已失效</p>
			</div>
		);
	}
	let content = "";
	if (article_id && 'content' in data && data.content) {
		content = await getArticle(data.content);
	}

	const isBookMode = !!book_id;

	return (
		<ReaderStoreProvider
			initialState={{
				article_id,
				book_id,
				mode: article_id ? 'article' : (book_id ? 'book' : null),
				data,
				content,
			}}
		>
			<div className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden relative">
				<Header isPopup={isPopup} />

				{/* 中间主要区域 */}
				<main className="flex flex-col lg:flex-row flex-1 overflow-hidden">
					{/* 摘要区域：通过内部的 order-first 实现在中窄屏居顶，在大屏受限于容器排布归位 */}
					<Summary />

					{/* 章节+正文容器：在中、大屏下始终保持 flex-row 并排 */}
					<div className="flex flex-1 flex-row overflow-hidden lg:order-first">
						{isBookMode && (
							<aside className="w-64 hidden md:flex flex-col h-full flex-none">
								<ChaptersWrapper />
							</aside>
						)}
						<Content />
					</div>
				</main>

				{/* 移动端专用挂件 */}
				{isBookMode && <MobileChaptersDrawer />}

				<Footer />
			</div>
		</ReaderStoreProvider>
	);
}
