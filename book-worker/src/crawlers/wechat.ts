import { parseHTML } from 'linkedom';
import createDOMPurify from 'dompurify';

// 初始化 DOMPurify 实例 (单例模式)
const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
const DOMPurify = createDOMPurify(window as any);

/**
 * 微信公众号文章解析器
 */
export function extract(document: any) {
  // 1. 提取标题
  const title = document.getElementById("activity-name")?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    "微信文章";

  // 2. 提取正文容器
  const jsContent = document.getElementById("js_content");
  if (!jsContent) return null;

  // 3. 执行清洗
  const cleanContent = cleanHtml(jsContent);

  return {
    title,
    content: cleanContent,
    source: "微信公众号"
  };
}

/**
 * 清洗 HTML 容器内容
 * @param container DOM 容器节点 (linkedom Node)
 * @returns 清洗后的 HTML 字符串
 */
function cleanHtml(container: any): string {
  let sentenceId = 0;
  const getNextId = () => ++sentenceId;

  // 1. 结构平坦化：剥掉冗余容器，合并碎片节点
  normalizeStructure(container);

  const children = Array.from(container.childNodes);
  const fragments: string[] = [];

  children.forEach((node: any) => {
    const html = transformNode(node, getNextId).trim();
    if (!html) return;

    // 块级标签列表，用于判断是否需要额外包裹 <p>
    const isBlockAlready = /^\s*<(p|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|table|hr|pre)/i.test(html);

    if (isBlockAlready) {
      fragments.push(html);
    } else {
      fragments.push(`<p>${html}</p>`);
    }
  });

  const rawHtml = fragments.join('\n');

  // 3. 安全净化 (Sanitize)
  // 配置白名单，仅保留业务必需的标签和属性
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'span', 'strong', 'b', 'em', 'i', 'sub', 'sup', 'del',
      'ul', 'ol', 'li', 'blockquote', 'table', 'tr', 'td', 'th', 'hr', 'pre', 'code',
      'img', 'br'
    ],
    ALLOWED_ATTR: ['id', 'class', 'src', 'alt'],
    // 强制校验协议
    ADD_TAGS: ['iframe'], // 如果后续需要支持嵌入视频，可在此开启
    ALLOW_DATA_ATTR: false,
  });

  return sanitizedHtml;
}

/**
 * 辅助函数：平坦化 DOM 结构，剥离冗余的 inline 容器
 */
function normalizeStructure(container: any) {
  const tagsToStrip = ['span', 'section', 'font'];

  const walk = (node: any) => {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === 1) {
        walk(child);
        const tag = child.tagName.toLowerCase();
        // 如果是冗余容器，则将其子节点提升到父级，然后删除自己
        if (tagsToStrip.includes(tag)) {
          while (child.firstChild) {
            node.insertBefore(child.firstChild, child);
          }
          node.removeChild(child);
        }
      }
      child = next;
    }
  };

  walk(container);
  // 合并相邻的文本节点
  container.normalize();
}

/**
 * 递归处理节点，提取核心内容并注入句子 ID
 */
function transformNode(node: any, getNextId: () => number): string {
  // 1. 处理文本节点
  if (node.nodeType === 3) {
    const text = node.textContent?.trim();
    if (!text) return "";
    return splitSentences(text)
      .map(s => `<span class="sentence" id="s-${getNextId()}">${s}</span>`)
      .join('');
  }

  // 2. 处理元素节点
  if (node.nodeType === 1) {
    const tagName = node.tagName.toLowerCase();

    // 图片特殊处理
    if (tagName === 'img') {
      const src = node.getAttribute('data-src') ||
        node.getAttribute('src') ||
        node.getAttribute('data-actualsrc'); // 增加一些常见的 Data 属性
      return src ? `<img src="${src}">` : "";
    }

    // 换行保留
    if (tagName === 'br') return "<br>";

    // 定义要保留的标签白名单
    const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'tr', 'td', 'th', 'hr', 'pre', 'code'];
    const INLINE_TAGS = ['strong', 'b', 'em', 'i', 'sub', 'sup', 'del'];

    // 递归处理子节点
    let innerContent = "";
    Array.from(node.childNodes).forEach((child: any) => {
      innerContent += transformNode(child, getNextId);
    });

    if (!innerContent.trim() && tagName !== 'hr') return "";

    // 如果在白名单中，保留标签名但清除所有旧样式和属性
    if (BLOCK_TAGS.includes(tagName)) {
      return `<${tagName}>${innerContent}</${tagName}>`;
    }
    if (INLINE_TAGS.includes(tagName)) {
      return `<${tagName}>${innerContent}</${tagName}>`;
    }

    // 如果是辅助容器（如 div, section, span），则“透传”其经过处理的内容
    return innerContent;
  }

  return "";
}

/**
 * 将文本拆分为句子
 */
function splitSentences(text: string): string[] {
  if (!text.trim()) return [];

  // 改进的正则：匹配以标点（。！？!?……）结尾的片段，或者不带标点的片段
  const regex = /([^。！？!?……\n]+([。！？!?……\n]|\.{3})*)/g;
  const matches = text.match(regex);

  return matches ? matches.map(s => s.trim()).filter(Boolean) : [text.trim()].filter(Boolean);
}
