import { NextResponse } from 'next/server';
import { createHandler, HandlerContext } from '../../_handler';

/**
 * 此时使用 Route Handler 代替 Server Action
 * 以绕过 Next.js 默认的 1MB Body 限制并支持大文件上传
 */
export const POST = createHandler(async ({ env, ctx, user }: HandlerContext, request: Request) => {
	const userId = user.sub;

	// 1. 解析并校验表单
	const formData = await request.formData();
	const file = formData.get('file') as File;
	if (!file) {
		return NextResponse.json({ error: 'No file provided' }, { status: 400 });
	}

	if (!file.name.toLowerCase().endsWith('.epub')) {
		return NextResponse.json({ error: 'Only .epub files are supported' }, { status: 400 });
	}

	const bookId = crypto.randomUUID();

	// 2. D1 数据库记录初始化 (同步阻塞)
	const title = file.name.replace(/\.[^/.]+$/, "");
	await env.LEAF_BOOK_DB.prepare(
		"INSERT INTO books (id, user_id, title, status) VALUES (?, ?, ?, ?)"
	).bind(
		bookId,
		userId,
		title,
		"uploading"
	).run();

	// 3. 异步上传 R2 (非阻塞)
	// 在边缘计算环境下，需预读取 arrayBuffer 确保数据不失效
	const arrayBuffer = await file.arrayBuffer();

	const uploadTask = async () => {
		try {
			const key = `books/${userId}/${bookId}/original.epub`;
			await env.LEAF_BOOK_BUCKET.put(key, arrayBuffer, {
				httpMetadata: { contentType: 'application/epub+zip' },
			});

			// 更新状态
			await env.LEAF_BOOK_DB.prepare(
				"UPDATE books SET status = ? WHERE id = ?"
			).bind("processing", bookId).run();

			console.log(`[Route API] Successfully uploaded book to R2: ${bookId}`);

			// 调用 book-worker 进行图书处理
			const stub = await env.BOOK_WORKER.processBook(userId, bookId);
			stub?.dispose?.();
		} catch (error) {
			console.error("[Route API] R2 upload error:", error);
			await env.LEAF_BOOK_DB.prepare(
				"UPDATE books SET status = ? WHERE id = ?"
			).bind("error", bookId).run();
		}
	};

	// 放入后台任务延迟执行
	ctx.waitUntil(uploadTask());

	// 4. 立即响应
	return {
		success: true,
		bookId,
	};
});
