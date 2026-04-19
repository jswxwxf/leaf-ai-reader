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
  const [object, summaryObject] = await Promise.all([
    env.LEAF_BOOK_BUCKET.get(contentKey),
    env.LEAF_BOOK_BUCKET.get(summaryKey)
  ]);

  // 以摘要文件作为“哨兵”：它是在流程最后一步才落盘的
  const summaryText = summaryObject ? await summaryObject.text() : null;
  const isSummaryProcessing = summaryText === "__PROCESSING__";
  const isSummaryReady = !!summaryText && !isSummaryProcessing;

  // 1. 最终状态：摘要已就绪（意味着正文必然也已写入）
  if (isSummaryReady) {
    if (isPrefetch) {
      console.log(`[API] Prefetch hit (ready) for: ${path}`);
      return { status: 'ready', prefetched: true };
    }
    console.log(`[API] Serving ready content from R2 for: ${path}`);
    const text = (await object?.text()) || "";
    let summaryArr = null;
    try {
      const parsed = JSON.parse(summaryText!);
      summaryArr = parsed.summaries || parsed;
    } catch (e) {
      console.error(`[API] Failed to parse summary for ${path}:`, e);
    }

    return {
      status: 'ready',
      content: text,
      summary: summaryArr
    };
  }

  // 2. 处理中状态：摘要哨兵标记为 PROCESSING
  if (isSummaryProcessing) {
    const secondsElapsed = (Date.now() - summaryObject!.uploaded.getTime()) / 1000;
    if (secondsElapsed < 45) { // AI 摘要可能较慢，放宽到 45s
      return { status: 'processing' };
    }
    console.log(`[API] Summary sentinel expired (${Math.round(secondsElapsed)}s), re-triggering: ${summaryKey}`);
  }

  // 3. 初始触发：摘要文件不存在或已过期
  // 仅在摘要文件上写入占位符作为进度锁定
  await env.LEAF_BOOK_BUCKET.put(summaryKey, "__PROCESSING__", {
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
