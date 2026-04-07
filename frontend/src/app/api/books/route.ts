import { createHandler } from '../_handler';
import { getBooks } from '@/lib/book';

/**
 * 获取当前登录用户的所有书籍列表
 */
export const GET = createHandler(async () => {
	// 调用 lib/book.ts 中封装好的业务逻辑
	const results = await getBooks();

	return {
		success: true,
		books: results,
	};
});
