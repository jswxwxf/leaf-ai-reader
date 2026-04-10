"use server";

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser } from './auth';

/**
 * 文章数据模型接口
 */
export interface ArticleData {
	id: string;
	title: string;
	source_url: string;
	source?: string;
	status: 'processing' | 'ready' | 'error';
	content?: string;
	created_at: string; // D1 中的 DATETIME
}

/**
 * 获取当前登录用户的所有文章列表
 */
export async function getArticles(
	cloudflare?: { env: CloudflareEnv; ctx?: ExecutionContext }
): Promise<ArticleData[]> {
	// 1. 鉴权
	const user = await getCurrentUser();
	if (!user?.sub) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 运行环境 (D1)：优先使用传入的参数，否则才调用上下文
	const { env } = cloudflare || getCloudflareContext();

	// 3. 执行 D1 数据库查询
	const { results } = await env.LEAF_BOOK_DB.prepare(
		"SELECT * FROM articles WHERE user_id = ? ORDER BY created_at DESC"
	).bind(user.sub).all();

	return (results || []) as unknown as ArticleData[];
}

/**
 * 删除文章
 * 同步删除数据库记录，并在后台异步删除 R2 关联文件
 */
export async function deleteArticle(
	id: string,
	cloudflare?: { env: CloudflareEnv; ctx: ExecutionContext }
): Promise<{ success: boolean }> {
	// 1. 鉴权
	const user = await getCurrentUser();
	const userId = user?.sub;
	if (!userId) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 上下文：优先使用传入的参数，否则从上下文获取
	const { env, ctx } = cloudflare || getCloudflareContext();

	// 3. 执行 D1 数据库删除并校验所有权
	const { meta } = await env.LEAF_BOOK_DB.prepare(
		"DELETE FROM articles WHERE id = ? AND user_id = ?"
	).bind(id, userId).run();

	if (meta.changes === 0) {
		throw new Error('Article not found or unauthorized');
	}

	// 4. 定义异步后台清理任务 (删除 R2 上的所有关联文件)
	const cleanupTask = async () => {
		try {
			const prefix = `articles/${userId}/${id}/`;
			
			// 列表查询该前缀下的所有文件
			const listed = await env.LEAF_BOOK_BUCKET.list({ prefix });
			const keys = listed.objects.map(o => o.key);

			if (keys.length > 0) {
				// 批量删除
				await env.LEAF_BOOK_BUCKET.delete(keys);
				console.log(`[lib/article] Successfully cleaned up ${keys.length} R2 files for article: ${id}`);
			}
		} catch (error) {
			console.error("[lib/article] Failed to cleanup R2 files:", error);
		}
	};

	// 让清理任务在后台运行
	ctx.waitUntil(cleanupTask());

	return { success: true };
}
