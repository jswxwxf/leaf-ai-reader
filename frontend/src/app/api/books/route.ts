import { createHandler } from '../_handler';
import { getBooks, deleteBook } from '@/lib/book';

/**
 * 获取当前登录用户的所有书籍列表
 */
export const GET = createHandler(async ({ env, ctx }) => {
	// 调用 lib/book.ts 中封装好的业务逻辑
	const results = await getBooks({ env, ctx });

	return {
		success: true,
		books: results,
	};
});

/**
 * 删除指定的书籍
 * 地址：DELETE /api/books?id=xxx
 */
export const DELETE = createHandler(async ({ env, ctx }, request: Request) => {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get('id');

	if (!id) {
		throw new Error('Book ID is required');
	}

	return await deleteBook(id, { env, ctx });
});
