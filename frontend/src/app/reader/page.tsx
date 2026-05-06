import { Reader } from "./_components/reader";
import { SpeechMode } from "./_store/store";
import { normalizePathKey } from "./_utils/utils";

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
	const key = `${book_id ?? ''}-${article_id ?? ''}-${normalizePathKey(path)}`;

	return (
		<Reader 
			key={key}
			isPopup={false} 
			article_id={article_id} 
			book_id={book_id} 
			path={path}
			speechMode={speechMode}
		/>
	);
}
