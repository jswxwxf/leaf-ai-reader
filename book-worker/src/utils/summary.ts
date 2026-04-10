/**
 * 将带有 s-ID 的 HTML 转换为 AI 紧凑型文本格式
 * 格式示例: [s-0] 句子内容 [s-1] 下一句内容...
 */
export function toCompactText(html: string): string {
  // 1. 替换标题，添加 Markdown 标记和换行
  let text = html.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (match, content) => {
    const idMatch = content.match(/id="s-(\d+)"/i);
    const cleanContent = content.replace(/<[^>]+>/g, '').trim();
    return `\n\n# ${idMatch ? `[s-${idMatch[1]}] ` : ''}${cleanContent}\n\n`;
  });

  // 2. 替换段落，添加换行
  text = text.replace(/<\/p>/gi, '\n\n');

  // 3. 提取带 ID 的 span 内容并转换格式
  text = text.replace(/<span[^>]+id="s-(\d+)"[^>]*>(.*?)<\/span>/gi, (match, id, content) => {
    const cleanContent = content.replace(/<[^>]+>/g, '').trim();
    if (!cleanContent) return '';
    return `[s-${id}] ${cleanContent} `;
  });

  // 4. 清理剩余的 HTML 标签
  text = text.replace(/<[^>]+>/g, '');

  // 5. 清理多余空格和换行
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n')
    .replace(/\s+/g, ' ')
    .replace(/(\[s-\d+\])/g, ' $1')
    .trim();
}

export interface AISummary {
  summary: string;
  start_sId: string;
}

export interface AISummaryResponse {
  summaries: AISummary[];
}

/**
 * 调用 AI 生成结构化摘要（默认使用 Gemini，回退至 Workers AI）
 */
export async function generateSummary(
  ai: any,
  content: string,
  geminiApiKey?: string,
  geminiApiBaseUrl?: string
): Promise<AISummaryResponse | null> {
  const systemPrompt = `你是一个专业的阅读助手。你的任务是为长文章提炼核心脉络。

### 重要指引
1. **忽略 ID 干扰**：输入文本中的 [s-ID] 仅用于定位起始位置，**它们不是列表编号**。请不要理会 ID 的数量，仅从逻辑和语义上对文章进行分段。
2. **合并分段**：你必须将几十个甚至上百个连续的句子归纳为 3 到 8 个逻辑大块。
3. **极简总结**：每个逻辑块生成一条 15 字以内的总结，并标明在该块起始处的 start_sId。

### 约束
- **数量**：全文仅限输出 3-8 条摘要。
- **格式**：严格仅返回 JSON 对象，结构为 { "summaries": [ { "summary": "...", "start_sId": "..." } ] }。`;

  const MAX_SAFE_CHARS = 10000;
  const safeContent = content.length > MAX_SAFE_CHARS
    ? content.slice(0, MAX_SAFE_CHARS) + "\n\n...(内容过长，已被系统截断)..."
    : content;

  // 1. 尝试使用 Gemini (优先使用，带一次重试)
  if (geminiApiKey) {
    let attempts = 0;
    while (attempts < 2) {
      try {
        console.log(`[AI] Using Gemini 2.5 Flash (Attempt ${attempts + 1})...`);
        const geminiResponse = await callGemini(geminiApiKey, systemPrompt, safeContent, geminiApiBaseUrl);
        if (geminiResponse) return geminiResponse;
      } catch (e: any) {
        attempts++;
        if (attempts < 2 && (e.message.includes('503') || e.message.includes('UNAVAILABLE'))) {
          console.warn(`[AI] Gemini busy (503), waiting 2s for retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        console.warn(`[AI] Gemini failed after ${attempts} attempts: ${e.message}`);
        break; 
      }
    }
  }

  // 2. 最终回退到 Cloudflare Workers AI (Llama 3.1 70B)
  try {
    console.log('[AI] Falling back to Cloudflare Workers AI (Llama 3.1 70B)...');
    const response: any = await ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请提炼全文核心脉络（只需 3-8 条摘要）：\n\n${safeContent}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          type: 'object',
          properties: {
            summaries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                  start_sId: { type: 'string' }
                },
                required: ['summary', 'start_sId']
              }
            }
          },
          required: ['summaries']
        }
      },
      max_tokens: 1024
    }, {
      gateway: {
        id: 'leaf-ai-reader-gateway',
        skipCache: false
      }
    });

    return parseWorkersAIResponse(response);
  } catch (error) {
    console.error('[AI] All AI providers failed:', error);
    return null;
  }
}

/**
 * 解析 Workers AI 多变的响应结构
 */
function parseWorkersAIResponse(response: any): AISummaryResponse | null {
  if (response?.response?.summaries) return response.response as AISummaryResponse;
  
  let contentString = '';
  if (response?.choices?.[0]?.message?.content) {
    contentString = response.choices[0].message.content;
  } else if (typeof response?.response === 'string') {
    contentString = response.response;
  } else if (response?.result?.response) {
    if (typeof response.result.response === 'object' && response.result.response.summaries) {
      return response.result.response as AISummaryResponse;
    }
    contentString = String(response.result.response);
  } else if (response?.summaries) {
    return response as AISummaryResponse;
  }

  if (!contentString) return null;

  try {
    const jsonMatch = contentString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const cleanContent = (jsonMatch ? jsonMatch[1] : contentString).trim();
    return JSON.parse(cleanContent) as AISummaryResponse;
  } catch (e) {
    console.error('[AI] Workers AI JSON parse failed:', e, 'Raw:', contentString);
    return null;
  }
}

/**
 * 调用 Gemini API
 */
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  apiBaseUrl?: string
): Promise<AISummaryResponse | null> {
  // 升级至 Gemini 2.5 Flash
  const model = "gemini-2.5-flash";
  // 默认使用官方地址，允许通过环境变量覆盖
  const baseUrl = apiBaseUrl || "https://generativelanguage.googleapis.com";
  // 使用 v1beta 以支持 response_mime_type
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n请提炼全文核心脉络（只需 3-8 条摘要）：\n\n${userContent}` }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      top_p: 0.8,
      top_k: 40,
      max_output_tokens: 4096,
      response_mime_type: "application/json",
      // 添加显式的 JSON Schema 约束，确保输出稳定
      response_schema: {
        type: "object",
        properties: {
          summaries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                summary: { type: "string" },
                start_sId: { type: "string" }
              },
              required: ["summary", "start_sId"]
            }
          }
        },
        required: ["summaries"]
      }
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
  }

  const data: any = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) return null;

  // 清理可能存在的 Markdown 代码块标记 (```json ... ```)
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      cleanText = match[1];
    }
  }

  try {
    return JSON.parse(cleanText) as AISummaryResponse;
  } catch (e) {
    console.error('[AI] Gemini JSON parse failed:', e, 'Raw text:', text);
    return null;
  }
}

