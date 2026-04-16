import { NextResponse } from 'next/server';
import { createHandler } from '../../../../_handler';

/**
 * 获取指定书籍的特定章节内容
 * GET /api/books/[bookId]/chapters/[path]
 */
export const GET = createHandler(async ({ env, ctx, user }, request, { params }) => {
  // 1. 从 Next.js context 中获取动态路由参数
  const { bookId, path } = await params;

  if (!bookId || !path) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const userId = user.sub;
  const contentKey = `books/${userId}/${bookId}/content/${path}`;

  // 2. 尝试从 R2 获取已缓存的章节内容
  const object = await env.LEAF_BOOK_BUCKET.get(contentKey);

  if (object) {
    const text = await object.text();
    
    if (text === "__PROCESSING__") {
      const secondsElapsed = (Date.now() - object.uploaded.getTime()) / 1000;
      
      // 如果占位符已经存在超过 30 秒，说明之前的处理可能失败，允许重新触发
      if (secondsElapsed < 30) {
        return { status: 'processing' };
      }
      console.log(`[API] Placeholder expired (${Math.round(secondsElapsed)}s), re-triggering for: ${contentKey}`);
    } else {
      // 否则返回正式正文
      return { 
        status: 'ready', 
        content: text 
      };
    }
  }

  // 3. 首次请求或占位符已过期：先写占位符，再异步触发 Worker 处理
  await env.LEAF_BOOK_BUCKET.put(contentKey, "__PROCESSING__", {
    httpMetadata: { contentType: 'text/plain; charset=utf-8' }
  });

  ctx.waitUntil((async () => {
    try {
      console.log(`[API] Triggering background process for: ${contentKey}`);
      const result = await env.BOOK_WORKER.processChapter(userId, bookId, path);
      // 释放 RPC 句柄
      (result as any)?.dispose?.();
    } catch (e) {
      console.error("[API] Background processing failed:", e);
    }
  })());

  return { status: 'processing' };
});
