import { NextResponse } from 'next/server';
import { createHandler } from '../../../_handler';

/**
 * 获取书籍内部资源代理接口 (镜像原 EPUB 目录结构)
 * GET /api/books/[bookId]/resource?path=[internalPath]
 */
export const GET = createHandler(async ({ env, ctx, user }, request, { params }) => {
  const { bookId } = await params;
  const url = new URL(request.url);
  const path = url.searchParams.get('path');

  if (!bookId || !path) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const userId = user.sub;
  // 镜像存储路径，放置在书籍内容的 content 目录下
  const contentKey = `books/${userId}/${bookId}/content/${path}`;

  // 1. 尝试从 R2 读取缓存
  const object = await env.LEAF_BOOK_BUCKET.get(contentKey);

  if (object) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Access-Control-Allow-Origin', '*');
    // 设置强缓存，因为图书内部资源通常不可变
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    const contentType = getContentType(path);
    if (contentType) headers.set('Content-Type', contentType);

    return new Response(object.body, { headers });
  }

  // 2. 缓存未命中，调用 Worker RPC 接口进行实时提取
  try {
    // 这里假设 Worker 已经实现了 processResource 方法
    const fileData = await env.BOOK_WORKER.processResource(userId, bookId, path);
    if (!fileData) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const contentType = getContentType(path);

    // 3. 异步回写到 R2 (不阻塞当前请求)
    ctx.waitUntil((async () => {
      await env.LEAF_BOOK_BUCKET.put(contentKey, fileData as any, {
        httpMetadata: { contentType: contentType || 'application/octet-stream' }
      });
    })());

    // 4. 返回响应数据
    const headers = new Headers();
    if (contentType) headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(fileData as any, { headers });

  } catch (e: any) {
    console.error(`[API] Resource extraction failed: ${path}`, e);
    return NextResponse.json({ error: 'Resource unavailable' }, { status: 500 });
  }
});

/**
 * 辅助函数：简单的扩展名 MIME 匹配
 */
function getContentType(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'css': 'text/css',
    'js': 'application/javascript',
  };
  return map[ext || ''] || null;
}
