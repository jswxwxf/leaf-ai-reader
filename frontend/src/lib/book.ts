"use server";

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser } from './auth';
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
}

/**
 * 获取当前登录用户的所有书籍列表 (Server Action)
 * 封装了鉴权、上下文获取和数据库查询的最核心逻辑
 */
export async function getBooks(): Promise<BookData[]> {
	// 1. 鉴权
	const user = await getCurrentUser();
	if (!user?.sub) {
		throw new Error('Unauthorized');
	}

	// 2. 获取 Cloudflare 运行环境 (D1)
	const { env } = getCloudflareContext();

	// 3. 执行 D1 数据库查询
	const { results } = await env.LEAF_BOOK_DB.prepare(
		"SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC"
	).bind(user.sub).all();

	return (results || []) as unknown as BookData[];
}
