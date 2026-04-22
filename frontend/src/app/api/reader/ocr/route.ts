import { NextResponse } from 'next/server';
import { createHandler, type HandlerContext } from '../../_handler';

/**
 * 图片 OCR 文字识别 API 接口
 * POST /api/reader/ocr
 * Body: { bookId: string, path: string }
 */
export const POST = createHandler(async ({ env, user }: HandlerContext, request) => {
  try {
    const { bookId, path, url } = await request.json();

    if (!url && (!bookId || !path)) {
      return NextResponse.json({ error: 'Missing parameters: provide either (bookId + path) or url' }, { status: 400 });
    }

    // 调用 Worker RPC 接口进行实时 OCR 识别
    // @ts-ignore - processOCR 签名已更新，但类型定义可能未同步
    const result = await env.BOOK_WORKER.processOCR(user.sub, { bookId, path, url });

    if (!result || !result.description) {
      // 兼容模型返回结构
      const text = result.response || result.description || 'No text detected';
      return { text };
    }

    return { text: result.description };

  } catch (e: any) {
    console.error(`[API] OCR Bridge failed:`, e);
    return NextResponse.json({ 
      error: 'OCR recognition failed', 
      details: e.message 
    }, { status: 500 });
  }
});
