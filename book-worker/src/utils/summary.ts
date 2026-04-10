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
 * 调用 Workers AI 生成结构化摘要
 */
export async function generateSummary(
  ai: any,
  content: string
): Promise<AISummaryResponse | null> {
  const systemPrompt = `你是一个专业的阅读助手。你的任务是为文章生成结构化的导读总结。

### 任务描述
1. 我会给你一段已经预处理的文章正文，其中每个句子都带有形如 [s-索引] 的前缀。
2. 你需要将文章内容划分为 3-8 个逻辑分段（取决于文章长度）。
3. 为每个分段生成一句极简的总结（10-20字以内）。
4. 你必须精准识别该段总结所对应的正文起始句子的 ID（start_sId）。
5. 优先识别文章中的结构化标志词（如“第一”、“第二”、“首先”、“其次”、“1.”、“2.”等），确保每个核心论点或分段步骤都能被一条独立的摘要覆盖。
6. **严禁合并列表项**：如果原文中出现了明显的“一、二、三”或“1、2、3”等编号列表，你必须为这些编号对应的每一个核心观点生成一条独立的摘要，不得为了精简而将它们合并成一条。
7. **过滤非正文信息**：严禁总结文末出现的广告、求关注、扫描二维码、公众号引导、社交媒体账号推荐、直播预告或免责声明等与文章核心观点无关的内容。

### 输出格式
必须仅返回 JSON 格式数据，结构如下：
{
  "summaries": [
    {
      "summary": "分段内容的简要描述",
      "start_sId": "s-0" 
    }
  ]
}

### 注意事项
- start_sId 必须严格对应输入文本中出现的 ID。
- 确保总结内容平滑、连续，能够覆盖文章核心脉络。
- 语言风格应专业、凝练。`;

  try {
    const response: any = await ai.run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请总结以下内容：\n\n${content}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          type: 'object',
          properties: {
            summaries: {
              type: 'array',
              minItems: 5,
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

    // 解析逻辑优化：兼容多种返回格式，支持从字符串中剥离 Markdown
    let finalResult: any = null;

    // 1. 尝试从 Cloudflare 直接返回的结构中提取
    if (response && response.response) {
      finalResult = response.response;
    } 
    // 2. 尝试从 OpenAI 风格的 choices 结构中提取
    else if (response && response.choices && response.choices[0]?.message?.content) {
      finalResult = response.choices[0].message.content;
    }
    // 3. 兜底：直接使用 response 本体
    else {
      finalResult = response;
    }

    // 如果结果是字符串，需要进行清理和解析
    if (typeof finalResult === 'string') {
      try {
        // 去除 Markdown 代码块标记（如 ```json ... ``` 或 ``` ... ```）
        const jsonMatch = finalResult.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const cleanContent = jsonMatch ? jsonMatch[1] : finalResult;
        
        // 尝试解析 JSON
        const parsed = JSON.parse(cleanContent.trim());
        return parsed as AISummaryResponse;
      } catch (e) {
        console.error('Failed to parse AI response string:', e, 'Raw content:', finalResult);
        return null;
      }
    }

    return finalResult as AISummaryResponse;
  } catch (error) {
    console.error('AI Summary Generation Error:', error);
    return null;
  }
}
