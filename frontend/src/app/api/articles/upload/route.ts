import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createHandler, HandlerContext } from '../../_handler';


/**
 * 接收来自阅读按钮的点击请求
 * 使用统一的 createHandler 进行包装，自动处理鉴权和 Cloudflare 上下文
 */
export const POST = createHandler(async ({ env, ctx, user }: HandlerContext, request: Request) => {
	// 获取请求体中的内容
	const { url } = (await request.json()) as { url: string };
	const articleId = crypto.randomUUID();
	console.log(`[Articles API] 用户 ${user.sub} 发起请求:`, { 
		content: url.length > 100 ? url.slice(0, 100) + '...' : url, 
		articleId 
	});

	// 1. 识别内容类型 (URL vs 纯文本)
	const isUrl = /^https?:\/\/.+/i.test(url);
	let title = '正在采集...';
	let source = '未知来源';
	let sourceUrl = url;

	if (isUrl) {
		try {
			source = new URL(url).hostname;
		} catch (e) {
			console.warn('[Articles API] 非标准 URL 来源:', url);
		}
	} else {
		// 纯文本模式：提取首行作为标题，源设为 "文本"
		title = url.split('\n')[0].trim().slice(0, 50) || '无标题文本';
		source = '文本';
		sourceUrl = 'raw.txt';

		// 将原始文本存入 R2 供 Worker 后续解析
		const rawKey = `articles/${user.sub}/${articleId}/raw.txt`;
		await env.LEAF_BOOK_BUCKET.put(rawKey, url, {
			httpMetadata: { contentType: 'text/plain; charset=utf-8' }
		});
		console.log(`[Articles API] 纯文本内容已暂存至 R2: ${rawKey}`);
	}

	// 2. 初始化 D1 数据库记录
	await env.LEAF_BOOK_DB.prepare(
		"INSERT INTO articles (id, user_id, title, source, source_url, status) VALUES (?, ?, ?, ?, ?, ?)"
	).bind(
		articleId,
		user.sub,
		title,
		source,
		sourceUrl,
		"processing"
	).run();

	// 2. 触发后台 Worker 解析逻辑 (非阻塞)
	ctx.waitUntil((async () => {
		try {
			const stub = await env.BOOK_WORKER.processArticle(user.sub, articleId);
			stub?.dispose?.();
		} catch (e) {
			console.error('[Articles API] 触发 Worker 解析失败:', e);
			// 发生异常时，将数据库中的状态更新为 error，防止前端无限轮询
			await env.LEAF_BOOK_DB.prepare(
				"UPDATE articles SET status = ? WHERE id = ?"
			).bind("error", articleId).run();
		}
	})());

	// 3. 告知 Next.js 刷新仪表盘页面的缓存数据
	revalidatePath('/dashboard');

	return {
		success: true,
		articleId,
		message: '采集任务已提交'
	};
});
