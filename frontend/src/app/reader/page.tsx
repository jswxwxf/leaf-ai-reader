import { Reader } from "./_components/reader";
import { SpeechMode } from "./_store/store";

type Props = {
	searchParams: Promise<{
		article_id?: string;
		book_id?: string;
		path?: string;
		speechMode?: SpeechMode;
	}>;
};

export default async function ReaderPage({ searchParams }: Props) {
	const { article_id, book_id, path, speechMode } = await searchParams;

	return (
		<Reader 
			key={`${book_id}-${article_id}-${path}`}
			isPopup={false} 
			article_id={article_id} 
			book_id={book_id} 
			path={path}
			speechMode={speechMode}
		/>
	);
}
