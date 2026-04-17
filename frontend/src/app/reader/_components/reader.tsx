import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "./header";
import { ChaptersWrapper, MobileChaptersDrawer } from "./chapters";
import { Content } from "./content";
import { Summary } from "./summary";
import { Footer } from "./footer";
import { Helper } from "./helper";
import { ReaderStoreProvider, type SpeechMode } from "../_store/store";
import { getArticle, getArticleData, type ArticleData } from "@/lib/article";
import { getBookData, getBookChapters, getFlattenChapters, type BookData } from "@/lib/book";

interface Props {
	isPopup?: boolean;
	article_id?: string | null;
	book_id?: string | null;
	path?: string | null;
	speechMode?: SpeechMode;
}

/**
 * 阅读器主框架组件
 * 作为一个服务器组件，它负责承载 StoreProvider 并将初始参数下发给客户端状态机
 */
export async function Reader({ isPopup = true, article_id, book_id, path, speechMode }: Props) {
	let data: ArticleData | BookData | null = null;
	if (article_id) {
		data = await getArticleData(article_id);
	} else if (book_id) {
		const [bookData, chapters, flattenChapters] = await Promise.all([
			getBookData(book_id),
			getBookChapters(book_id),
			getFlattenChapters(book_id)
		]);

		if (bookData) {
			bookData.chapters = chapters;
			bookData.flattenChapters = flattenChapters;
			data = bookData;

			// [服务端跳转逻辑] 如果只有 book_id 而没有 path，自动重定向到书签或第一章
			if (book_id && !path) {
				const targetPath = bookData.bookmark || flattenChapters[0]?.path;
				if (targetPath) {
					redirect(`/reader?book_id=${book_id}&path=${encodeURIComponent(targetPath)}`);
				}
			}
		}
	}

	if (!data) {
		const backView = book_id ? "books" : "articles";
		return (
			<div className="flex flex-col items-center justify-center h-screen bg-base-100 text-base-content/60">
				<div className="text-xl font-medium mb-2">数据加载失败</div>
				<p className="text-sm mb-6">内容不存在或链路已失效</p>
				<Link href={`/dashboard?view=${backView}`} className="btn btn-primary btn-outline btn-sm px-8">
					返回
				</Link>
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
				speechMode,
			}}
		>
			<Helper />
			<div className="flex flex-col h-dvh bg-base-100 text-base-content overflow-hidden relative pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
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
