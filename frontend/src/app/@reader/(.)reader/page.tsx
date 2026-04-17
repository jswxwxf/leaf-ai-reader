import { Reader } from "@/app/reader/_components/reader";
import { SpeechMode } from "@/app/reader/_store/store";

type Props = {
	searchParams: Promise<{
		article_id?: string;
		book_id?: string;
		path?: string;
		speechMode?: SpeechMode;
	}>;
};

/**
 * 拦截路由页面：当从 Dashboard 点击文章跳转时，
 * 此页面会作为平行路由插槽 (@reader) 渲染。
 */
export default async function ReaderInterceptPage({ searchParams }: Props) {
	const { article_id, book_id, path, speechMode } = await searchParams;

	return (
		<div className="fixed inset-0 z-40 bg-base-100 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
			{/* 拦截路由模式下，阅读器作为覆盖层出现 */}
			<Reader 
				key={`${book_id}-${article_id}-${path}`} 
				isPopup={true} 
				article_id={article_id} 
				book_id={book_id} 
				path={path}
				speechMode={speechMode}
			/>
		</div>
	);
}
