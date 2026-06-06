import { parseHTML } from 'linkedom';
import * as fflate from 'fflate';
import { EpubParser } from "../epub";
import { normalizeChapters, flattenChapters } from '../utils/chapter';
import { cleanHtml } from '../utils/html';

/**
 * 处理图书：从 R2 读取 EPUB，解析元数据、提取封面并写入目录信息。
 */
export async function processBook(env: Env, userId: string, bookId: string) {
  const epubKey = `books/${userId}/${bookId}/original.epub`;

  console.log(`[Indexer] Starting to process book ${bookId} for user ${userId}`);

  // 1. 获取 EPUB
  const object = await env.LEAF_BOOK_BUCKET.get(epubKey);
  if (!object) {
    throw new Error(`EPUB not found in R2: ${epubKey}`);
  }

  // 2. 加载与解析
  const buffer = await object.arrayBuffer();
  const parser = new EpubParser();
  await parser.load(buffer);

  const metadata = await parser.parse();

  // 3. 提取并保存封面图 (如果存在)
  let updatedCoverKey: string | null = null;
  if (metadata.coverPath) {
    const coverBuffer = await parser.getFile(metadata.coverPath, "uint8array");
    if (coverBuffer) {
      // 根据 MIME 类型确定扩展名
      const mimeMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
      };
      const extension = mimeMap[metadata.coverMime || ""] || "jpg";
      const coverR2Key = `books/${userId}/${bookId}/cover.${extension}`;

      await env.LEAF_BOOK_BUCKET.put(coverR2Key, coverBuffer, {
        httpMetadata: { contentType: metadata.coverMime || "image/jpeg" },
      });
      updatedCoverKey = coverR2Key;
      console.log(`[Indexer] Extracted and saved cover to ${coverR2Key} as ${metadata.coverMime}`);
    }
  }

  console.log(`[Indexer] Successfully parsed book: ${metadata.title}`);

  // 4.1 规范化并上传目录 (TOC) 到 R2
  const normalizedChapters = normalizeChapters(metadata.chapters);
  const tocR2Key = `books/${userId}/${bookId}/toc.json`;
  await env.LEAF_BOOK_BUCKET.put(tocR2Key, JSON.stringify(normalizedChapters), {
    httpMetadata: { contentType: "application/json" },
  });

  // 4.1.2 展平章节并上传到 R2
  const flattenedChapters = flattenChapters(normalizedChapters);
  const flattenTocR2Key = `books/${userId}/${bookId}/flatten-chapters.json`;
  await env.LEAF_BOOK_BUCKET.put(flattenTocR2Key, JSON.stringify(flattenedChapters), {
    httpMetadata: { contentType: "application/json" },
  });

  console.log(`[Indexer] Successfully uploaded toc.json and flatten-chapters.json`);

  // 4.2 更新书籍元数据
  try {
    await env.LEAF_BOOK_DB.prepare(
      `UPDATE books
       SET title = ?,
           author = ?,
         published_at = ?,
         cover_r2_key = ?,
         root_dir = ?,
         status = 'ready'
       WHERE id = ? AND user_id = ?`
    ).bind(
      metadata.title,
      metadata.author,
      metadata.publishDate,
      updatedCoverKey,
      metadata.rootDir,
      bookId,
      userId
    ).run();
    console.log(`[Indexer] Database update successful for book ${bookId}`);
  } catch (e: any) {
    console.error(`[Indexer] Database update failed for book ${bookId}: ${e.message}`);
    throw new Error(`Database update failed: ${e.message}`);
  }

  return {
    success: true,
    body: {
      title: metadata.title,
      author: metadata.author,
      publishedAt: metadata.publishDate,
      coverR2Key: updatedCoverKey,
    }
  };
}

/**
 * 解析单个 EPUB 章节，清洗 HTML、注入句子 ID，并写入 R2 缓存。
 */
export async function processChapter(env: Env, userId: string, bookId: string, chapterPath: string) {
  console.log(`[Worker] Started pure processing for: book=${bookId}, path=${chapterPath}`);

  const contentKey = `books/${userId}/${bookId}/content/${chapterPath}`;

  // 1. 从 D1 获取该书的物理根目录 (root_dir)
  const book = await env.LEAF_BOOK_DB.prepare(
    "SELECT root_dir FROM books WHERE id = ?"
  ).bind(bookId).first<{ root_dir: string }>();

  const rootDir = book?.root_dir || "";

  // 2. 从 R2 读取原文
  const epubKey = `books/${userId}/${bookId}/original.epub`;
  const epubObject = await env.LEAF_BOOK_BUCKET.get(epubKey);
  if (!epubObject) throw new Error(`[Worker] EPUB not found: ${epubKey}`);

  const epubBuffer = await epubObject.arrayBuffer();
  const uint8Array = new Uint8Array(epubBuffer);

  // 3. 解压并提取指定 HTML
  const decodedPath = decodeURIComponent(chapterPath);
  // 拼接真实全路径 (rootDir + decodedPath)
  const fullPath = rootDir + decodedPath;

  const unzipped = fflate.unzipSync(uint8Array, {
    filter: (file) => file.name === fullPath
  });

  const chapterFile = unzipped[fullPath];
  if (!chapterFile) {
    console.log("[Worker] ZIP Files available (partial):", Object.keys(unzipped).slice(0, 5));
    throw new Error(`[Worker] Chapter file not found at: ${fullPath}`);
  }

  // 3. 清洗且分句
  const htmlContent = new TextDecoder().decode(chapterFile);
  const { document } = parseHTML(htmlContent);
  const processedHtml = cleanHtml(document.body || document, {
    bookId,
    path: decodedPath
  });

  // 4. 存回 R2
  await env.LEAF_BOOK_BUCKET.put(contentKey, processedHtml, {
    httpMetadata: { contentType: 'text/html; charset=utf-8' }
  });

  // 5. 写入摘要占位符
  const summaryKey = `${contentKey}.summary.json`;
  await env.LEAF_BOOK_BUCKET.put(summaryKey, JSON.stringify({ summaries: [] }), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' }
  });
  console.log(`[Worker] Chapter processing done (summary skipped): ${chapterPath}`);

  return { success: true, key: contentKey };
}

/**
 * 按需从 EPUB 中提取图片等内部资源，返回原始二进制数据。
 */
export async function processResource(env: Env, userId: string, bookId: string, internalPath: string) {
  console.log(`[Worker] Processing resource: book=${bookId}, path=${internalPath}`);

  // 1. 获取 rootDir
  const book = await env.LEAF_BOOK_DB.prepare(
    "SELECT root_dir FROM books WHERE id = ?"
  ).bind(bookId).first<{ root_dir: string }>();
  const rootDir = book?.root_dir || "";

  // 2. 加载 EPUB
  const epubKey = `books/${userId}/${bookId}/original.epub`;
  const epubObject = await env.LEAF_BOOK_BUCKET.get(epubKey);
  if (!epubObject) throw new Error(`[Worker] EPUB not found: ${epubKey}`);

  const epubBuffer = await epubObject.arrayBuffer();
  const fullPath = rootDir + decodeURIComponent(internalPath);

  // 3. 提取文件
  const unzipped = fflate.unzipSync(new Uint8Array(epubBuffer), {
    filter: (file) => file.name === fullPath
  });

  const fileData = unzipped[fullPath];
  if (!fileData) {
    console.error(`[Worker] Resource not found in zip: ${fullPath}`);
    return null;
  }

  // 返回 Uint8Array，RPC 会处理传输
  return fileData;
}
