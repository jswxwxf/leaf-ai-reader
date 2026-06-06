import { parseHTML } from 'linkedom';
import { crawlArticle } from "../article";
import { cleanHtml } from "../utils/html";

/**
 * 处理文章：支持 URL 抓取和 raw.txt 纯文本数字化。
 */
export async function processArticle(env: Env, userId: string, articleId: string) {
  console.log(`[Worker] Received article process request: user=${userId}, articleId=${articleId}`);

  // 1. 从 D1 获取文章记录
  const article = await env.LEAF_BOOK_DB.prepare(
    "SELECT * FROM articles WHERE id = ? AND user_id = ?"
  ).bind(articleId, userId).first();

  if (!article) {
    throw new Error(`[Worker] Article ${articleId} not found in D1 for user ${userId}`);
  }

  try {
    let parsedArticle: { title: string; content: string; source: string };

    // 2. 识别内容来源：URL 抓取 vs 纯文本分词
    if ((article as any).source_url === "raw.txt") {
      console.log(`[Worker] Processing raw text from R2...`);

      // 2.1 从 R2 读取原文
      const rawKey = `articles/${userId}/${articleId}/raw.txt`;
      const rawObject = await env.LEAF_BOOK_BUCKET.get(rawKey);
      if (!rawObject) throw new Error(`Raw text object not found in R2: ${rawKey}`);
      const rawText = await rawObject.text();

      console.log(`[Worker] Raw text loaded, length: ${rawText.length}`);

      // 2.2 数字化转换：模拟 HTML 结构并利用 cleanHtml 工具类处理
      const simulatedBody = rawText.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(p => `<p>${p}</p>`)
        .join('\n');

      const { document } = parseHTML(`<!DOCTYPE html><html><body>${simulatedBody}</body></html>`);
      const digitalHtml = cleanHtml(document.body);

      console.log(`[Worker] Digitization complete, final HTML length: ${digitalHtml.length}`);

      parsedArticle = {
        title: (article as any).title,
        content: digitalHtml,
        source: '文本'
      };
    } else {
      console.log(`[Worker] Starting crawl for: ${article.source_url}`);
      // 3. 调用爬虫工具函数提取网页内容
      parsedArticle = await crawlArticle(article.source_url as string);
    }

    if ((env as any).NODE_ENV === 'development') {
      console.log(`[Worker] Successfully prepared article: ${parsedArticle.title}`);
    }

    // 3. 将正文 HTML 持久化到 R2
    const contentKey = `articles/${userId}/${articleId}/content.html`;
    await env.LEAF_BOOK_BUCKET.put(contentKey, parsedArticle.content, {
      httpMetadata: { contentType: "text/html;charset=UTF-8" },
    });
    console.log(`[Worker] Successfully saved article content to R2: ${contentKey}`);

    // 4. 更新 D1 状态为 ready (初始摘要设为 null，待手动触发)
    await env.LEAF_BOOK_DB.prepare(
      "UPDATE articles SET title = ?, content = ?, summary = ?, source = ?, status = 'ready' WHERE id = ?"
    ).bind(
      parsedArticle.title || article.title,
      contentKey,
      null,
      parsedArticle.source,
      articleId
    ).run();

    console.log(`[Worker] Article ${articleId} processed and metadata updated in D1`);

    return {
      title: parsedArticle.title,
      contentLength: parsedArticle.content.length
    };

  } catch (e: any) {
    console.error(`[Worker] Error processing article ${articleId}: ${e.message}`);

    // 更新 D1 状态为 error
    await env.LEAF_BOOK_DB.prepare(
      "UPDATE articles SET status = 'error' WHERE id = ?"
    ).bind(articleId).run();

    throw e;
  }
}
