import { parseHTML } from 'linkedom';
import { cleanHtml } from '../utils/html';

/**
 * 微信公众号文章解析器
 */
export function extract(document: any, rawHtml?: string) {
  // 1. 提取标题
  const title = document.getElementById("activity-name")?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    "微信文章";

  // 2. 提取正文容器
  let jsContent = document.getElementById("js_content");

  // 后备方案：如果 DOM 中找不到 js_content，尝试从原始 HTML 的 JS 变量中提取
  if ((!jsContent || !jsContent.textContent?.trim()) && rawHtml) {
    console.log("[WechatExtractor] js_content is empty or not found, trying JS variable extraction...");
    const jsExtractedHtml = tryExtractFromJsVariables(rawHtml);
    if (jsExtractedHtml) {
      const { document: tempDoc } = parseHTML(`<!DOCTYPE html><html><body><div id="js_content">${jsExtractedHtml}</div></body></html>`);
      jsContent = tempDoc.getElementById("js_content");
    }
  }

  if (!jsContent) return null;

  // 3. 执行清洗（封装在 utils/html.ts 中，包含分句逻辑）
  const cleanContent = cleanHtml(jsContent);

  return {
    title,
    content: cleanContent,
    source: "微信公众号"
  };
}

/**
 * 尝试从 HTML 源代码中的 JS 变量提取内容
 */
function tryExtractFromJsVariables(html: string): string | null {
  const contentRegex = /content:\s*JsDecode\(['"](.*?)['"]\)/s;
  const match = html.match(contentRegex);
  if (!match || !match[1]) return null;

  const decodedText = decodeJsContent(match[1]);
  if (!decodedText) return null;

  return decodedText
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${p}</p>`)
    .join('\n');
}

/**
 * 模拟微信浏览器的 JsDecode 函数
 */
function decodeJsContent(str: string): string {
  return str
    .replace(/\\x5c/g, '\\')
    .replace(/\\x0d/g, '\r')
    .replace(/\\x22/g, '"')
    .replace(/\\x26/g, '&')
    .replace(/\\x27/g, '\'')
    .replace(/\\x3c/g, '<')
    .replace(/\\x3e/g, '>')
    .replace(/\\x0a/g, '\n');
}
