import { NextResponse } from 'next/server';
import { createHandler, type HandlerContext } from '../_handler';
import { DEMO_ACCESS_MESSAGE } from '@/lib/access';

type SummaryTargetType = 'article' | 'book';

interface AISummary {
  summary: string;
  start_sId: string;
}

function isSummaryTargetType(value: unknown): value is SummaryTargetType {
  return value === 'article' || value === 'book';
}

function parseSummaries(value: unknown): AISummary[] | null {
  if (!Array.isArray(value)) return null;

  const summaries: AISummary[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;

    const { summary, start_sId } = item as Record<string, unknown>;
    if (typeof summary !== 'string' || typeof start_sId !== 'string') {
      return null;
    }

    summaries.push({ summary, start_sId });
  }

  return summaries;
}

/**
 * 全量覆盖保存摘要。
 * PUT /api/summary
 * Body: { type: 'article' | 'book', id: string, path?: string, summaries: AISummary[] }
 */
export const PUT = createHandler(async ({ env, user, access }: HandlerContext, request) => {
  if (!access.canUseSummary) {
    return NextResponse.json(
      {
        success: false,
        code: 'DEMO_FEATURE_DISABLED',
        error: DEMO_ACCESS_MESSAGE,
      },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { type, id, path } = body;
  const summaries = parseSummaries(body.summaries);

  if (!isSummaryTargetType(type) || typeof id !== 'string' || !id || !summaries) {
    return NextResponse.json({ error: 'Invalid summary payload' }, { status: 400 });
  }

  if (type === 'book' && (typeof path !== 'string' || !path)) {
    return NextResponse.json({ error: 'Missing path for book summary' }, { status: 400 });
  }

  try {
    const result = await env.BOOK_WORKER.updateSummary(
      user.sub,
      type,
      id,
      summaries,
      type === 'book' ? path : undefined,
    );
    const savedSummaries = result?.summary?.summaries || summaries;
    (result as any)?.dispose?.();

    return {
      success: true,
      summaries: savedSummaries,
    };
  } catch (e: any) {
    console.error('[API] Summary update failed:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to update summary' },
      { status: 500 },
    );
  }
});
