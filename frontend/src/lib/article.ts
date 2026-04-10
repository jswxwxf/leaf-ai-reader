"use server";

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { revalidatePath } from 'next/cache';
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
	summary?: string;
	created_at: string; // D1 中的 DATETIME
}

/**
 * 获取单篇文章元数据（只从 D1 数据库读取）
 */
export async function getArticleData(
	id: string,
	cloudflare?: { env: CloudflareEnv; ctx?: ExecutionContext }
): Promise<ArticleData | null> {
	// 1. 鉴权
	const user = await getCurrentUser();
	if (!user?.sub) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 运行环境
	const { env } = cloudflare || getCloudflareContext();

	// 3. 执行 D1 数据库查询获取元数据
	return (await env.LEAF_BOOK_DB.prepare(
		"SELECT * FROM articles WHERE id = ? AND user_id = ?"
	).bind(id, user.sub).first()) as unknown as ArticleData | null;
}

/**
 * 获取文章实际正文内容（只从 R2 Bucket 读取）
 * @param contentKey R2 中的存储路径 (例如 articles/user_id/article_id/content.html)
 */
export async function getArticle(
	contentKey: string,
	cloudflare?: { env: CloudflareEnv; ctx?: ExecutionContext }
): Promise<string> {
	// 1. 基本格式校验
	if (!contentKey || !contentKey.startsWith('articles/')) {
		return "";
	}

	// 2. 鉴权：验证当前用户是否有权访问该 Key
	const user = await getCurrentUser();
	const userId = user?.sub;
	// 路径格式通常为 articles/${userId}/${articleId}/...
	if (!userId || !contentKey.includes(`/${userId}/`)) {
		throw new Error('Unauthorized');
	}

	// 3. 获取上下文
	const { env } = cloudflare || getCloudflareContext();

	// 4. 从 R2 抓取正文
	try {
		const object = await env.LEAF_BOOK_BUCKET.get(contentKey);
		if (!object) return "";
		return await object.text();
	} catch (error) {
		console.error(`[lib/article] Failed to fetch content from R2:`, error);
		return "";
	}
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

	// 告知 Next.js 刷新仪表盘页面的缓存数据
	revalidatePath('/dashboard');

	return { success: true };
}
