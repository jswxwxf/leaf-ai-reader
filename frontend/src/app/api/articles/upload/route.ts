import { createHandler, HandlerContext } from '../../_handler';


/**
 * 接收来自阅读按钮的点击请求
 * 使用统一的 createHandler 进行包装，自动处理鉴权和 Cloudflare 上下文
 */
export const POST = createHandler(async ({ env, ctx, user }: HandlerContext, request: Request) => {
	// 获取请求体中的 URL
	const { url } = (await request.json()) as { url: string };
	const articleId = crypto.randomUUID();
	console.log(`[Articles API] 用户 ${user.sub} 发起采集请求:`, { url, articleId });

	// 1. 初始化 D1 数据库记录 (同步阻塞，确保回执前数据已落库)
	const title = '正在采集...';
	const source = new URL(url).hostname;
	await env.LEAF_BOOK_DB.prepare(
		"INSERT INTO articles (id, user_id, title, source, source_url, status) VALUES (?, ?, ?, ?, ?, ?)"
	).bind(
		articleId,
		user.sub,
		title,
		source,
		url,
		"processing"
	).run();

	// 2. 触发后台 Worker 解析逻辑 (非阻塞)
	ctx.waitUntil((async () => {
		try {
			await env.BOOK_WORKER.processArticle(user.sub, articleId);
		} catch (e) {
			console.error('[Articles API] 触发 Worker 解析失败:', e);
			// 发生异常时，将数据库中的状态更新为 error，防止前端无限轮询
			await env.LEAF_BOOK_DB.prepare(
				"UPDATE articles SET status = ? WHERE id = ?"
			).bind("error", articleId).run();
		}
	})());

	return {
		success: true,
		articleId,
		message: '采集任务已提交'
	};
});
