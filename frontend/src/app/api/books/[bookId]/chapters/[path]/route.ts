import { NextRequest, NextResponse } from "next/server";

/**
 * 获取指定书籍的特定章节内容
 * GET /api/books/[bookId]/chapters/[path]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; path: string }> }
) {
  const { bookId, path } = await params;

  // 占位逻辑：打印 bookId 和 path
  console.log("--- Chapter API Request ---");
  console.log("Book ID:", bookId);
  console.log("Chapter Path:", path);

  return NextResponse.json({
    message: "Chapter API Placeholder",
    bookId,
    path,
  });
}
