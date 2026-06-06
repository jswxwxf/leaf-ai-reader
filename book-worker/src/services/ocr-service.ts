import { splitSentences } from "../utils/sentence";
import { getGeminiKeys } from "./base-service";

interface OCRParams {
  bookId?: string;
  path?: string;
  url?: string;
}

/**
 * 根据 OCR 参数读取图片数据：优先书籍 R2 资源，其次外部 URL。
 */
async function loadImageBytes(env: Env, userId: string, params: OCRParams) {
  if (params.bookId && params.path) {
    const contentKey = `books/${userId}/${params.bookId}/content/${params.path}`;
    const object = await env.LEAF_BOOK_BUCKET.get(contentKey);
    if (!object) throw new Error(`Image not found in storage: ${params.path}`);
    return new Uint8Array(await object.arrayBuffer());
  }

  if (params.url) {
    const res = await fetch(params.url, {
      headers: { "User-Agent": "LeafReader-OCR/1.0" },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Failed to fetch remote image: ${res.statusText}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  throw new Error("Missing identification parameters (bookId/path or url)");
}

/**
 * 将图片字节编码为 Gemini inline_data 需要的 base64 字符串。
 */
function encodeBase64(uint8Array: Uint8Array) {
  return btoa(
    uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
}

/**
 * 调用 Gemini OCR 接口，返回模型提取出的纯文本。
 */
async function callGeminiOCR(apiKey: string, base64Image: string) {
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "请准确地提取并转录这张图片中的所有文字。请将文字合并为自然的段落，忽略由于图片物理布局导致的错误换行。保持原始的语义结构。仅返回纯净、格式化后的文本内容。如果没有检测到文字，请返回“(未检测到文字)”。" },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        max_output_tokens: 2048,
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
  }

  const data: any = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

/**
 * 图片 OCR 文字提取 (PRD-015)
 * 支持书籍内部资源 (R2) 和文章外部资源 (URL)
 */
export async function processOCR(env: Env, userId: string, params: OCRParams) {
  console.log(`[Worker] Starting Gemini OCR task:`, params);

  try {
    const uint8Array = await loadImageBytes(env, userId, params);
    const base64Image = encodeBase64(uint8Array);
    const geminiKeys = getGeminiKeys(env);

    if (geminiKeys.length === 0) throw new Error("No Gemini API keys configured");

    // 循环尝试 API 节点
    for (let i = 0; i < geminiKeys.length; i++) {
      const apiKey = geminiKeys[i];
      try {
        const text = await callGeminiOCR(apiKey, base64Image);

        if (text) {
          const description = text.trim();
          console.log(`[Worker] OCR success with Key #${i + 1}`);
          return {
            description, // 对齐之前的返回结构
            sentences: splitSentences(description)
          };
        }
      } catch (e: any) {
        console.warn(`[Worker] Gemini Key #${i + 1} failed: ${e.message}`);
        if (i === geminiKeys.length - 1) throw e;
      }
    }
  } catch (e: any) {
    console.error(`[Worker] OCR Engine failed: ${e.message}`);
    throw new Error(`OCR processing failed: ${e.message}`);
  }
}
