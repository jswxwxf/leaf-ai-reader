import { generateSummary, toCompactText, type AISummary } from "../utils/summary";
import { getGeminiKeys } from "./base-service";

type SummaryTargetType = 'article' | 'book';

/**
 * 调用 AI 摘要模型，将已清洗正文转换为结构化摘要 JSON。
 */
async function runAISummary(env: Env, title: string, content: string): Promise<string | null> {
  const isDev = (env as any).NODE_ENV === 'development';

  // 开发环境下强行跳过 AI，返回 Mock 数据以填充哨兵文件
  if (isDev) {
    console.log(`[Worker] Skipping AI summary for ${title} in dev mode.`);
    return JSON.stringify({
      summaries: [],
      source: 'mock-dev'
    });
  }

  try {
    console.log(`[Worker] Starting AI summary calculation for: ${title}`);
    const compactText = toCompactText(content);

    const summaryResult = await generateSummary(
      env.AI,
      compactText,
      env.GEMINI_API_KEY,
      getGeminiKeys(env).slice(1)
    );

    if (summaryResult) {
      console.log(`[Worker] Successfully generated AI summary for ${title} (${summaryResult.summaries?.length || 0} items)`);
      return JSON.stringify(summaryResult);
    }
  } catch (e) {
    console.error(`[Worker] AI Summary generation failed for ${title}:`, e);
  }

  return null;
}

/**
 * 重新生成摘要：直接读取 R2 中已有正文，不重新执行解压或爬取。
 */
export async function processSummary(env: Env, userId: string, type: SummaryTargetType, id: string, path?: string) {
  console.log(`[Worker] Manually re-processing summary: type=${type}, id=${id}, path=${path}`);

  let contentKey = "";
  let title = "";

  if (type === 'book') {
    if (!path) throw new Error("Path is required for book summary");
    contentKey = `books/${userId}/${id}/content/${path}`;
    title = path; // 书籍路径作为临时标题上下文
  } else {
    contentKey = `articles/${userId}/${id}/content.html`;
    // 尝试从 D1 获取标题作为上下文
    const article = await env.LEAF_BOOK_DB.prepare(
      "SELECT title FROM articles WHERE id = ?"
    ).bind(id).first<{ title: string }>();
    title = article?.title || "Article";
  }

  // 1. 从 R2 读取已存在的清洗后的内容
  const object = await env.LEAF_BOOK_BUCKET.get(contentKey);
  if (!object) throw new Error(`Processed content not found in R2: ${contentKey}`);
  const content = await object.text();

  // 2. 重新运行 AI 摘要
  const summaryJson = await runAISummary(env, title, content);
  const resultSummary = summaryJson ? JSON.parse(summaryJson) : { summaries: [] };

  // 3. 持久化结果
  if (type === 'book') {
    const summaryKey = `${contentKey}.summary.json`;
    await env.LEAF_BOOK_BUCKET.put(summaryKey, summaryJson || JSON.stringify({ summaries: [] }), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' }
    });
  } else {
    await env.LEAF_BOOK_DB.prepare(
      "UPDATE articles SET summary = ? WHERE id = ?"
    ).bind(summaryJson, id).run();
  }

  return { success: true, summary: resultSummary };
}

/**
 * 全量覆盖保存摘要，用于用户删除、新增或修改摘要后的持久化。
 */
export async function updateSummary(env: Env, userId: string, type: SummaryTargetType, id: string, summaries: AISummary[], path?: string) {
  console.log(`[Worker] Updating summary: type=${type}, id=${id}, path=${path}, count=${summaries.length}`);

  const summaryPayload = { summaries };
  const summaryJson = JSON.stringify(summaryPayload);

  if (type === 'book') {
    if (!path) throw new Error("Path is required for book summary");

    const book = await env.LEAF_BOOK_DB.prepare(
      "SELECT id FROM books WHERE id = ? AND user_id = ?"
    ).bind(id, userId).first<{ id: string }>();
    if (!book) {
      throw new Error("Book not found or unauthorized");
    }

    const contentKey = `books/${userId}/${id}/content/${path}`;
    const contentObject = await env.LEAF_BOOK_BUCKET.get(contentKey);
    if (!contentObject) {
      throw new Error(`Processed content not found in R2: ${contentKey}`);
    }

    const summaryKey = `${contentKey}.summary.json`;
    await env.LEAF_BOOK_BUCKET.put(summaryKey, summaryJson, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' }
    });

    return { success: true, summary: summaryPayload };
  }

  const { meta } = await env.LEAF_BOOK_DB.prepare(
    "UPDATE articles SET summary = ? WHERE id = ? AND user_id = ?"
  ).bind(summaryJson, id, userId).run();

  if (meta.changes === 0) {
    throw new Error("Article not found or unauthorized");
  }

  return { success: true, summary: summaryPayload };
}
