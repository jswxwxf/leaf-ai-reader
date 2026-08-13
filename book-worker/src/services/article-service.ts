import { parseHTML } from 'linkedom';
import { crawlArticle } from "../article";
import { cleanHtml } from "../utils/html";
import { processMarkdownArticle } from '../utils/markdown';

const RAW_AI_PREFIX = /^raw[:：]\s*/i;
const RAW_AI_SOURCE = "AI 整理文本";
const MARKDOWN_PREFIX = /^md[:：]\s*/i;
const MARKDOWN_SOURCE = 'Markdown';

interface OrganizedRawText {
  content: string;
}

interface ParsedArticle {
  title: string;
  content: string;
  source: string;
}

async function organizeRawTextWithWorkersAI(env: Env, rawText: string): Promise<OrganizedRawText> {
  const systemPrompt = `你是一个专业中文编辑，正在把语音转写稿整理成适合阅读器阅读的文章。

请严格遵守：
1. 只整理表达，不新增事实、不补充背景、不改变原文立场。
2. 删除明显重复的口癖、语气词和转写噪音，让句子更通顺。
3. 保留人名、地名、数字、专有名词、观点顺序和重要细节。
4. 必须按语义自然分段，避免输出成一整段；段落之间用一个空行分隔。
5. 不要总结、不要评论、不要输出 Markdown、不要输出 JSON、不要输出标题前缀。
6. 只输出整理后的正文文本。`;

  console.log(`[Worker] Organizing raw text with Workers AI...`);
  const response: any = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `<raw_transcript>\n${rawText}\n</raw_transcript>` },
    ],
    max_tokens: 4096,
  }, {
    gateway: {
      id: 'leaf-ai-reader-gateway',
      skipCache: true,
    }
  });

  const content = extractWorkersAIText(response)
    .replace(/^```(?:\w+)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!content) {
    throw new Error("Workers AI returned empty raw text organization result");
  }

  return { content };
}

function extractWorkersAIText(response: any): string {
  if (typeof response === 'string') return response;
  if (typeof response?.response === 'string') return response.response;
  if (typeof response?.result?.response === 'string') return response.result.response;
  if (typeof response?.choices?.[0]?.message?.content === 'string') return response.choices[0].message.content;
  return '';
}

async function processPlainTextArticle(
  env: Env,
  rawText: string,
  initialTitle: string
): Promise<ParsedArticle> {
  let title = initialTitle;
  let source = '文本';

  if (RAW_AI_PREFIX.test(rawText)) {
    rawText = rawText.replace(RAW_AI_PREFIX, '').trim();
    const fallbackTitle = rawText.split('\n')[0]?.trim().slice(0, 50);
    const organized = await organizeRawTextWithWorkersAI(env, rawText);
    rawText = organized.content;
    title = fallbackTitle || title;
    source = RAW_AI_SOURCE;
    console.log(`[Worker] Raw text organized by Workers AI, length: ${rawText.length}`);
  }

  const simulatedBody = rawText.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(p => `<p>${p}</p>`)
    .join('\n');

  const { document } = parseHTML(`<!DOCTYPE html><html><body>${simulatedBody}</body></html>`);
  const content = cleanHtml(document.body);

  console.log(`[Worker] Digitization complete, final HTML length: ${content.length}`);

  return { title, content, source };
}

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
    let parsedArticle: ParsedArticle | undefined;

    // 2. 识别内容来源：URL 抓取 vs 纯文本分词
    if ((article as any).source_url === "raw.txt") {
      console.log(`[Worker] Processing raw text from R2...`);

      // 2.1 从 R2 读取原文
      const rawKey = `articles/${userId}/${articleId}/raw.txt`;
      const rawObject = await env.LEAF_BOOK_BUCKET.get(rawKey);
      if (!rawObject) throw new Error(`Raw text object not found in R2: ${rawKey}`);
      let rawText = await rawObject.text();

      console.log(`[Worker] Raw text loaded, length: ${rawText.length}`);

      const isMarkdown = MARKDOWN_PREFIX.test(rawText);
      parsedArticle = isMarkdown
        ? { ...processMarkdownArticle(rawText, (article as any).title), source: MARKDOWN_SOURCE }
        : await processPlainTextArticle(env, rawText, (article as any).title);
    } else {
      console.log(`[Worker] Starting crawl for: ${article.source_url}`);
      // 3. 调用爬虫工具函数提取网页内容
      parsedArticle = await crawlArticle(article.source_url as string);
    }

    if (!parsedArticle) {
      throw new Error(`[Worker] Article ${articleId} processing produced no content`);
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
