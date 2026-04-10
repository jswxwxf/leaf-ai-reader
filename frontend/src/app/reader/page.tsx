import { Reader } from "./_components/reader";

type Props = {
	searchParams: Promise<{
		article_id?: string;
		book_id?: string;
	}>;
};

export default async function ReaderPage({ searchParams }: Props) {
	const { article_id, book_id } = await searchParams;

	return (
		<Reader 
			isPopup={false} 
			article_id={article_id} 
			book_id={book_id} 
		/>
	);
}
