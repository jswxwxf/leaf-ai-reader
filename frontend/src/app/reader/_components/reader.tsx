import { Header } from "./header";
import { Chapters } from "./chapters";
import { Content } from "./content";
import { Summary } from "./summary";
import { Footer } from "./footer";
import { ReaderStoreProvider } from "../_store/store";
import { getArticle, getArticleData, type ArticleData } from "@/lib/article";
import { getBookData, type BookData } from "@/lib/book";

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
		data = await getBookData(book_id);
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

	return (
		<ReaderStoreProvider
			initialState={{
				article_id,
				book_id,
				data,
				content,
			}}
		>
			<div className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden font-sans">
				<Header isPopup={isPopup} />

				{/* 中间主要区域 */}
				<main className="flex flex-1 overflow-hidden">
					{/* 仅在非文章模式（即书籍模式）下显示目录 */}
					{!article_id && <Chapters />}

					<Content />

					<Summary />
				</main>

				<Footer />
			</div>
		</ReaderStoreProvider>
	);
}
