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

const MAX_SAFE_CHARS = 10000;
const MAX_SUMMARY_CHUNKS = 8;

/**
 * 对 AI 生成的摘要进行规范化处理：去重 + 排序
 */
function normalizeSummaries(summaries: AISummary[]): AISummary[] {
  if (!summaries || !Array.isArray(summaries)) return [];

  return summaries
    // 0. 规范化 start_sId：AI 有时会返回 "[s-123]"、"第 s-123 句" 等变体。
    .map((item) => {
      const idNumber = item.start_sId?.match(/\d+/)?.[0];
      return {
        ...item,
        start_sId: idNumber ? `s-${idNumber}` : ''
      };
    })
    // 1. 去重：防止 AI 产生重复的总结项
    .filter((item, index, self) =>
      item.summary &&
      item.start_sId &&
      index === self.findIndex((t) => t.summary === item.summary)
    )
    // 2. 排序：按 start_sId 提取的数字进行升序排列，确保与原文顺序一致
    .sort((a, b) => {
      const aId = parseInt(a.start_sId?.replace(/[^\d]/g, '') || '0', 10);
      const bId = parseInt(b.start_sId?.replace(/[^\d]/g, '') || '0', 10);
      return aId - bId;
    });
}

/**
 * 按 [s-ID] 句子边界切分，避免把一句话拆到两个 AI 请求里。
 */
function splitSummaryChunks(content: string, maxChars: number): string[] {
  const sentencePattern = /(?:^|\s)(?:#\s*)?\[s-\d+\][\s\S]*?(?=\s(?:#\s*)?\[s-\d+\]|$)/g;
  const sentences = content.match(sentencePattern)?.map((item) => item.trim()).filter(Boolean);

  if (!sentences || sentences.length === 0) {
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += maxChars) {
      chunks.push(content.slice(i, i + maxChars));
    }
    return chunks;
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (!currentChunk) {
      currentChunk = sentence;
      continue;
    }

    if (currentChunk.length + sentence.length + 1 > maxChars) {
      chunks.push(currentChunk);
      currentChunk = sentence;
      continue;
    }

    currentChunk += ` ${sentence}`;
  }

  if (currentChunk) chunks.push(currentChunk);

  return chunks;
}

/**
 * 调用 AI 生成结构化摘要（默认使用 Gemini，回退至 Workers AI）
 */
export async function generateSummary(
  ai: any,
  content: string,
  geminiApiKey?: string,
  secondaryGeminiKeys: (string | undefined)[] = []
): Promise<AISummaryResponse | null> {
  const systemPrompt = `你是一个专业的阅读助手。你的任务是为长文章提炼核心脉络。

### 重要指引
1. **忽略 ID 干扰**：输入文本中的 [s-ID] 仅用于定位起始位置。请不要理会 ID 的数量，仅从逻辑和语义上对文章进行分段。
2. **保留显式列举结构**：如果原文中出现作者刻意组织的条目化内容、步骤、原则、结论、小结或要点清单，请优先按原文的条目边界逐条提取。条目边界可能表现为编号、项目符号、分点标题或顺序递进表达。此时不要为了满足默认数量限制而强行合并、删减或打散这些条目。
3. **合并分段**：默认情况下，你必须将几十个甚至上百个连续的句子归纳为 3 到 8 个逻辑大块。
4. **极简原创总结**：每条项必须控制在 15 字以内且必须标明 start_sId。默认严禁摘抄原文或搬运原句，必须由你用自己的语言进行高度概括；若原文存在明确条目化结构，应保留条目边界和顺序，并用短语压缩表达每条核心含义。
5. **均匀分布**：摘要点必须分布在全文的不同阶段。**每个摘要点必须对应一个 [s-ID] 标记。**
6. **绝对纯文本**：总结内容必须是纯文本，**严禁包含任何 HTML 标签 (如 <div>, <p> 等)**。

### 约束
- **数量**：默认全文输出 3-8 条摘要；如果原文存在明显条目化结构，且这些条目本身承载核心观点、步骤、原则、结论或小结，请按条目数量输出，允许超过 8 条。
- **格式**：严格仅返回 JSON 对象，结构为 { "summaries": [ { "summary": "...", "start_sId": "..." } ] }。`;

  const chunkSystemPrompt = `你是一个专业的阅读助手。你的任务是为长文章片段提炼核心脉络。

### 重要指引
1. **当前输入只是全文片段**：请只总结当前片段中出现的内容，不要猜测前后文。
2. **忽略 ID 干扰**：输入文本中的 [s-ID] 仅用于定位起始位置。请不要理会 ID 的数量，仅从逻辑和语义上对片段进行分段。
3. **保留显式列举结构**：如果当前片段中出现作者刻意组织的条目化内容、步骤、原则、结论、小结或要点清单，请优先按原文的条目边界逐条提取。条目边界可能表现为编号、项目符号、分点标题或顺序递进表达。此时不要为了满足默认数量限制而强行合并、删减或打散这些条目。
4. **合并分段**：默认情况下，你必须将多个连续句子归纳为少量逻辑块。
5. **极简原创总结**：每条项必须控制在 15 字以内且必须标明 start_sId。默认严禁摘抄原文或搬运原句，必须由你用自己的语言进行高度概括；若原文存在明确条目化结构，应保留条目边界和顺序，并用短语压缩表达每条核心含义。
6. **均匀分布**：摘要点应分布在当前片段的不同阶段。**每个摘要点必须对应一个 [s-ID] 标记。**
7. **绝对纯文本**：总结内容必须是纯文本，**严禁包含任何 HTML 标签 (如 <div>, <p> 等)**。

### 约束
- **数量**：默认当前片段输出 3-8 条摘要；如果当前片段存在明显条目化结构，且这些条目本身承载核心观点、步骤、原则、结论或小结，请按条目数量输出，允许超过 8 条。
- **格式**：严格仅返回 JSON 对象，结构为 { "summaries": [ { "summary": "...", "start_sId": "..." } ] }。`;

  // 整理所有可用的 Gemini Key
  const geminiKeys = [geminiApiKey, ...secondaryGeminiKeys].filter(Boolean) as string[];

  if (content.length > MAX_SAFE_CHARS) {
    const chunks = splitSummaryChunks(content, MAX_SAFE_CHARS);
    const selectedChunks = chunks.slice(0, MAX_SUMMARY_CHUNKS);
    const allSummaries: AISummary[] = [];

    console.log(`[AI] Content too long, splitting summary into ${chunks.length} chunks...`);
    if (chunks.length > selectedChunks.length) {
      console.warn(`[AI] Summary chunks limited to ${selectedChunks.length}/${chunks.length} to control AI cost.`);
    }

    for (let i = 0; i < selectedChunks.length; i++) {
      console.log(`[AI] Generating summary chunk ${i + 1}/${selectedChunks.length}...`);
      const chunkResult = await generateSingleSummary(
        ai,
        selectedChunks[i],
        chunkSystemPrompt,
        geminiKeys,
        "请提炼当前片段核心脉络（默认输出 3-8 条极简摘要；若片段存在明显条目化结构，请逐条保留并允许超过 8 条；每条摘要严控在 15 字以内）"
      );

      if (chunkResult?.summaries?.length) {
        allSummaries.push(...chunkResult.summaries);
      } else {
        console.warn(`[AI] Summary chunk ${i + 1}/${selectedChunks.length} returned no result.`);
      }
    }

    return allSummaries.length > 0
      ? { summaries: normalizeSummaries(allSummaries) }
      : null;
  }

  return generateSingleSummary(
    ai,
    content,
    systemPrompt,
    geminiKeys,
    "请提炼全文核心脉络（默认输出 3-8 条极简摘要；若原文存在明显条目化结构，请逐条保留并允许超过 8 条；每条摘要严控在 15 字以内）"
  );
}

async function generateSingleSummary(
  ai: any,
  content: string,
  systemPrompt: string,
  geminiKeys: string[],
  workersAIUserPrompt: string
): Promise<AISummaryResponse | null> {
  // 1. 尝试使用 Gemini (支持多 Key 轮询)
  for (let i = 0; i < geminiKeys.length; i++) {
    const currentKey = geminiKeys[i];
    const accountLabel = `Account #${i + 1}`;

    try {
      console.log(`[AI] Using Gemini (${accountLabel})...`);
      const geminiResponse = await callGemini(currentKey, systemPrompt, content);
      if (geminiResponse) {
        return { summaries: normalizeSummaries(geminiResponse.summaries) };
      }
    } catch (e: any) {
      console.warn(`[AI] Gemini (${accountLabel}) failed: ${e.message}`);

      // 如果还有下一个 Key，继续尝试
      if (i < geminiKeys.length - 1) {
        console.log(`[AI] Switching to next available Gemini key...`);
        continue;
      }
    }
  }

  // 2. 最终回退到 Cloudflare Workers AI (Llama 3.1 70B)
  try {
    console.log('[AI] Falling back to Cloudflare Workers AI (Llama 3.1 70B)...');
    const response: any = await ai.run('@cf/meta/llama-3.1-70b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${workersAIUserPrompt}：\n\n${content}` },
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
                  summary: { type: 'string', description: '极简总结，不超过 15 字' },
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

    const workersAIResponse = parseWorkersAIResponse(response);
    if (workersAIResponse) {
      return { summaries: normalizeSummaries(workersAIResponse.summaries) };
    }
    return null;
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
  userContent: string
): Promise<AISummaryResponse | null> {
  // 升级至 Gemini 2.5 Flash
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n请提炼以下文章的核心脉络（只需输出 JSON，严禁输出待总结内容以外的任何 HTML 或标志）：\n\n<article>\n${userContent}\n</article>` }]
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
