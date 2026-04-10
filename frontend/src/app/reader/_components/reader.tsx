import { Header } from "./header";
import { Chapters } from "./chapters";
import { Content } from "./content";
import { Highlights } from "./highlights";
import { Footer } from "./footer";
import { ReaderStoreProvider } from "../_store/store";

interface Props {
	isPopup?: boolean;
	article_id?: string | null;
	book_id?: string | null;
}

/**
 * 阅读器主框架组件
 * 作为一个服务器组件，它负责承载 StoreProvider 并将初始参数下发给客户端状态机
 */
export function Reader({ isPopup = true, article_id, book_id }: Props) {
	return (
		<ReaderStoreProvider
			initialState={{
				article_id,
				book_id,
			}}
		>
			<div className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden font-sans">
				<Header isPopup={isPopup} />

				{/* 中间主要区域 */}
				<main className="flex flex-1 overflow-hidden">
					{/* 仅在非文章模式（即书籍模式）下显示目录 */}
					{!article_id && <Chapters />}

					<Content />

					<Highlights />
				</main>

				<Footer />
			</div>
		</ReaderStoreProvider>
	);
}
