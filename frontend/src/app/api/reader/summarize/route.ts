import { NextResponse } from 'next/server';
import { createHandler } from '../../_handler';

/**
 * 手动触发 AI 摘要重新生成
 * POST /api/reader/summarize
 * Payload: { type: 'article' | 'book', id: string, path?: string }
 */
export const POST = createHandler(async ({ env, user }, request) => {
  const body = await request.json();
  const { type, id, path } = body;

  if (!type || !id) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // 调用 Worker RPC 同步等待
    const result = await env.BOOK_WORKER.processSummary(user.sub, type, id, path);
    
    // 获取摘要数据并手动释放句柄
    const summaries = result?.summary?.summaries || [];
    (result as any)?.dispose?.();

    return { 
      success: true, 
      summaries 
    };
  } catch (e: any) {
    console.error("[API] Summarize Error:", e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
});
