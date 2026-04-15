"use server";

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './auth';
/**
 * 章节结构定义
 */
export interface Chapter {
	id?: string;
	title: string;
	path: string;
	level: number;
	children: Chapter[];
}

/**
 * 书籍数据模型接口
 */
export interface BookData {
	id: string;
	title: string;
	author?: string;
	published_at?: string;
	status: 'uploading' | 'processing' | 'ready' | 'error';
	cover_r2_key?: string | null;
	total_chapters?: number;
	created_at: number;
	chapters?: Chapter[]; // 注入的目录数据
}

/**
 * 获取当前登录用户的所有书籍列表 (Server Action)
 * 封装了鉴权、上下文获取和数据库查询的最核心逻辑
 */
export async function getBooks(
	cloudflare?: { env: CloudflareEnv; ctx?: ExecutionContext }
): Promise<BookData[]> {
	// 1. 鉴权
	const user = await getCurrentUser();
	if (!user?.sub) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 运行环境 (D1)：优先使用传入参数
	const { env } = cloudflare || getCloudflareContext();

	// 3. 执行 D1 数据库查询
	const { results } = await env.LEAF_BOOK_DB.prepare(
		"SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC"
	).bind(user.sub).all();

	return (results || []) as unknown as BookData[];
}

/**
 * 获取单本书籍元数据（只从 D1 数据库读取）
 */
export async function getBookData(
	id: string,
	cloudflare?: { env: CloudflareEnv; ctx?: ExecutionContext }
): Promise<BookData | null> {
	// 1. 鉴权
	const user = await getCurrentUser();
	if (!user?.sub) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 运行环境
	const { env } = cloudflare || getCloudflareContext();

	// 3. 执行 D1 数据库查询获取元数据
	return (await env.LEAF_BOOK_DB.prepare(
		"SELECT * FROM books WHERE id = ? AND user_id = ?"
	).bind(id, user.sub).first()) as unknown as BookData | null;
}

/**
 * 从 R2 获取书籍目录 (toc.json)
 */
export async function getBookChapters(
	id: string,
	cloudflare?: { env: CloudflareEnv; ctx?: ExecutionContext }
): Promise<Chapter[]> {
	// 1. 鉴权
	const user = await getCurrentUser();
	if (!user?.sub) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 环境
	const { env } = cloudflare || getCloudflareContext();

	// 3. 构建 R2 Key 并读取
	const tocKey = `books/${user.sub}/${id}/toc.json`;
	try {
		const object = await env.LEAF_BOOK_BUCKET.get(tocKey);
		if (!object) {
			console.warn(`[lib/book] TOC not found for book: ${id}`);
			return [];
		}
		return await object.json() as Chapter[];
	} catch (e) {
		console.error(`[lib/book] Failed to fetch TOC for book ${id}:`, e);
		return [];
	}
}

/**
 * 删除书籍 (Server Action / 内部逻辑)
 * 同步删除数据库记录，并在后台异步删除 R2 关联文件
 */
export async function deleteBook(
	id: string,
	cloudflare?: { env: CloudflareEnv; ctx: ExecutionContext }
): Promise<{ success: boolean }> {
	// 1. 鉴权
	const user = await getCurrentUser();
	const userId = user?.sub;
	if (!userId) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 上下文：优先使用传入参数
	const { env, ctx } = cloudflare || getCloudflareContext();

	// 3. 执行 D1 数据库删除并校验所有权
	// 如果不是当前用户的书，SQL 里的 WHERE 就会滤掉它，导致 meta.changes === 0
	const { meta } = await env.LEAF_BOOK_DB.prepare(
		"DELETE FROM books WHERE id = ? AND user_id = ?"
	).bind(id, userId).run();

	if (meta.changes === 0) {
		throw new Error('Book not found or unauthorized');
	}

	// 4. 定义异步后台清理任务 (删除 R2 上的所有关联文件)
	const cleanupTask = async () => {
		try {
			const prefix = `books/${userId}/${id}/`;
			
			// 列表查询该前缀下的所有文件
			const listed = await env.LEAF_BOOK_BUCKET.list({ prefix });
			const keys = listed.objects.map(o => o.key);

			if (keys.length > 0) {
				// 批量删除
				await env.LEAF_BOOK_BUCKET.delete(keys);
				console.log(`[lib/book] Successfully cleaned up ${keys.length} R2 files for book: ${id}`);
			}
		} catch (error) {
			console.error("[lib/book] Failed to cleanup R2 files:", error);
		}
	};

	// 使用 ctx.waitUntil 让清理任务在响应返回后继续在后台运行
	ctx.waitUntil(cleanupTask());

	// 告知 Next.js 刷新仪表盘页面的缓存数据
	revalidatePath('/dashboard');

	return { success: true };
}
