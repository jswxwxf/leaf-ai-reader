import { NextResponse } from 'next/server';
import { createHandler } from '../../../../_handler';

/**
 * 获取指定书籍的特定章节内容
 * GET /api/books/[bookId]/chapters/[path]
 */
export const GET = createHandler(async ({ env, ctx, user }, request, { params }) => {
  // 1. 从 Next.js context 中获取动态路由参数
  const { bookId, path } = await params;
  const isPrefetch = request.nextUrl.searchParams.get('prefetch') === '1';

  if (!bookId || !path) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const userId = user.sub;
  const contentKey = `books/${userId}/${bookId}/content/${path}`;
  const summaryKey = `${contentKey}.summary.json`;

  // 2. 尝试从 R2 获取已缓存的章节内容和对应的 AI 摘要
  const [contentObject, summaryObject] = await Promise.all([
    env.LEAF_BOOK_BUCKET.get(contentKey),
    env.LEAF_BOOK_BUCKET.get(summaryKey)
  ]);

  // 以正文文件作为状态哨兵
  const contentText = contentObject ? await contentObject.text() : null;
  const isContentProcessing = contentText === "__PROCESSING__";
  const isContentReady = !!contentText && !isContentProcessing;

  // 1. 最终状态：正文已就绪
  if (isContentReady) {
    if (isPrefetch) {
      console.log(`[API] Prefetch hit (ready) for: ${path}`);
      return { status: 'ready', prefetched: true };
    }
    console.log(`[API] Serving ready content from R2 for: ${path}`);
    
    const summaryText = summaryObject ? await summaryObject.text() : null;
    let summaryArr = null;
    if (summaryText) {
      try {
        const parsed = JSON.parse(summaryText);
        summaryArr = parsed.summaries || parsed;
      } catch (e) {
        console.error(`[API] Failed to parse summary for ${path}:`, e);
      }
    }

    return {
      status: 'ready',
      content: contentText,
      summary: summaryArr
    };
  }

  // 2. 处理中状态：正文文件标记为 PROCESSING
  if (isContentProcessing) {
    const secondsElapsed = (Date.now() - contentObject!.uploaded.getTime()) / 1000;
    if (secondsElapsed < 30) { // 纯内容解析通常较快
      return { status: 'processing' };
    }
    console.log(`[API] Content sentinel expired (${Math.round(secondsElapsed)}s), re-triggering: ${contentKey}`);
  }

  // 3. 初始触发：正文文件不存在或已过期
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
