import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { createHandler } from '../../../_handler';

/**
 * 更新书籍阅读进度
 * POST /api/books/[bookId]/progress
 */
export const POST = createHandler(async ({ env, user }, request, { params }) => {
  const { bookId } = await params;
  const { bookmark, progress } = await request.json();

  if (!bookId || typeof bookmark !== 'string' || typeof progress !== 'number') {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  await env.LEAF_BOOK_DB.prepare(
    'UPDATE books SET bookmark = ?, progress = ? WHERE id = ? AND user_id = ?',
  )
    .bind(bookmark, progress, bookId, user.sub)
    .run();

  revalidatePath('/dashboard');

  return { success: true };
});
