import { createHandler } from '../_handler';
import { getArticles, deleteArticle } from '@/lib/article';

/**
 * 获取当前登录用户的所有文章列表
 */
export const GET = createHandler(async () => {
	// 调用 lib/article.ts 中封装好的业务逻辑
	const results = await getArticles();

	return {
		success: true,
		articles: results,
	};
});

/**
 * 删除指定的文章
 * 地址：DELETE /api/articles?id=xxx
 */
export const DELETE = createHandler(async (_ctx, request: Request) => {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get('id');

	if (!id) {
		throw new Error('Article ID is required');
	}

	return await deleteArticle(id);
});
