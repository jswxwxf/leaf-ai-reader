import { parseHTML } from 'linkedom';
import createDOMPurify from 'dompurify';
import { splitSentences } from './sentence';

// 初始化 DOMPurify 实例
const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
const DOMPurify = createDOMPurify(window as any);

/**
 * 通用的 HTML 清理与数字化（分句）工具
 * 使用 id="s-N" 和 class="sentence" 以保持与现有流程兼容
 */
export function cleanHtml(container: any, options?: { bookId?: string, path?: string }): string {
  let sentenceId = 0;
  const getNextId = () => ++sentenceId;

  // 1. Pre-pass (DOM 级规范化)
  normalizeStructure(container);

  const children = Array.from(container.childNodes);
  const fragments: string[] = [];
  let inlineBuffer: string[] = [];

  const flushBuffer = () => {
    if (inlineBuffer.length > 0) {
      const content = inlineBuffer.join('').trim();
      if (content) {
        fragments.push(`<p>${content}</p>`);
      }
      inlineBuffer = [];
    }
  };

  children.forEach((node: any) => {
    const html = transformNode(node, getNextId, options);
    if (!html) return;

    const isBlock = /^\s*<(p|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|table|hr|pre|br)/i.test(html);

    if (isBlock) {
      flushBuffer();
      fragments.push(html.trim());
    } else {
      inlineBuffer.push(html);
    }
  });

  flushBuffer();

  // 2. Main-pass (数字化/序列化)
  const rawHtml = fragments.join('\n');

  // 3. Secondary-pass (排版精美化/二次清洗 - NEW)
  const refinedHtml = refineHtml(rawHtml);

  // 4. Post-pass (安全净化)
  return DOMPurify.sanitize(refinedHtml, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'span', 'strong', 'b', 'em', 'i', 'sub', 'sup', 'del',
      'ul', 'ol', 'li', 'blockquote', 'table', 'tr', 'td', 'th', 'hr', 'pre', 'code',
      'img', 'br'
    ],
    ALLOWED_ATTR: ['id', 'class', 'src', 'alt', 'loading'],
  });
}

/**
 * 二次清洗逻辑：针对输出的 HTML 字符串进行排版打磨
 */
function refineHtml(html: string): string {
  if (!html) return '';

  return html
    // 1. Span 提升 (Span Promotion)
    // 将 <b><span class="sentence" id="s-N">文本</span></b> 转换为 <span class="sentence" id="s-N"><b>文本</b></span>
    .replace(/<(strong|b|em|i|del|a)([^>]*)>\s*<span class="sentence" id="s-(\d+)">(.*?)<\/span>\s*<\/\1>/gi, '<span class="sentence" id="s-$3"><$1$2>$4</$1></span>')

    // 2. 句子缝合 (Sentence Healing)
    // 关键修正：支持跨越 sup, sub 引文标签。
    // 排除集包含：。！？；：!?…… 以及各类闭合引号/括号
    .replace(/([^。！？；：!?……\.\!\\?\;”’』」》）〉】〗｝\"'\)\]\}：:])<\/span>(\s*(?:<br\s*\/?>|<sup>.*?<\/sup>|<sub>.*?<\/sub>|\s)*)<span class="sentence" id="s-\d+">/gi, '$1$2')

    // 3. 清理空段落
    .replace(/<p>\s*(?:&nbsp;|&#160;|&#8203;|\u200B)*\s*<\/p>/gi, '')

    // 4. 清理无意义的 br 包装段落 (常见于微信公众号)
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '')

    // 5. 清理可能产生的双重 p 包装（容错）
    .replace(/<p>\s*(<p>.*?<\/p>)\s*<\/p>/gis, '$1')

    // 6. 将连续的 3 个或以上 <br /> 压缩为 2 个
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br /><br />')

    // 7. 将连续的 2 个或以上纯换行/空格压缩
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function normalizeStructure(container: any) {
  const tagsToStrip = ['span', 'font', 'div', 'fieldset', 'a'];
  // 彻底移除且不保留内容的标签
  const tagsToRemove = ['script', 'style', 'noscript', 'template', 'iframe', 'canvas', 'video', 'audio', 'svg', 'button', 'input', 'select', 'textarea'];

  const walk = (node: any) => {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;

      // 1. 移除注释、文档类型等非实质性节点
      if (child.nodeType !== 1 && child.nodeType !== 3) {
        node.removeChild(child);
        child = next;
        continue;
      }

      if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();

        // 2. 彻底移除黑名单标签及其所有子节点
        if (tagsToRemove.includes(tag)) {
          node.removeChild(child);
          child = next;
          continue;
        }

        walk(child);

        // 3. 剥离外壳、保留内容的标签 (如无属性的 div)
        const isSimpleDiv = tag === 'div' && !child.id && !child.className;
        if (tagsToStrip.includes(tag) && (tag !== 'div' || isSimpleDiv)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
        }
      } else if (child.nodeType === 3) {
        // 4. 清理空白文本节点
        if (!child.textContent.trim()) {
          node.removeChild(child);
        }
      }
      child = next;
    }
  };
  walk(container);
  container.normalize();
}

/**
 * 路径归一化：将相对路径转换为相对于镜像根目录的绝对路径
 */
function resolvePath(basePath: string, relativePath: string): string {
  if (relativePath.startsWith('/') || /^[a-z]+:\/\//i.test(relativePath)) {
    return relativePath.replace(/^\//, '');
  }

  const baseParts = basePath.split('/').filter(p => p);
  baseParts.pop(); // 弹出当前文件名，保留所在目录路径

  const relativeParts = relativePath.split('/').filter(p => p);

  for (const part of relativeParts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.') {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

function transformNode(
  node: any,
  getNextId: () => number,
  options?: { bookId?: string, path?: string },
  skipSplitting: boolean = false
): string {
  if (node.nodeType === 3) {
    const text = node.textContent || "";
    if (!text.trim()) return "";
    if (/^\s+$/.test(text) && text.includes('\n')) return " ";

    // 如果处于分句豁免区（如在 sup 内部），则不进行分句，直接输出文本
    if (skipSplitting) {
      return text;
    }

    // 使用原有的 id="s-N" 和 class="sentence"
    return splitSentences(text)
      .map(s => `<span class="sentence" id="s-${getNextId()}">${s}</span>`)
      .join('');
  }

  if (node.nodeType === 1) {
    const tagName = node.tagName.toLowerCase();
    if (tagName === 'img') {
      let src = node.getAttribute('data-src') || node.getAttribute('src') || "";
      if (src && options?.bookId && options?.path) {
        const absPath = resolvePath(options.path, src);
        src = `/api/books/${options.bookId}/resource?path=${encodeURIComponent(absPath)}`;
      }
      return src ? `<img src="${src}" loading="lazy">` : "";
    }
    if (tagName === 'br') return "<br />";

    const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'tr', 'td', 'th', 'hr', 'pre', 'code'];
    const INLINE_TAGS = ['strong', 'b', 'em', 'i', 'sub', 'sup', 'del'];
    // 豁免名单：在这些标签内的文本不触发分句逻辑（通常仅限不含实质内容、仅为标记的标签）
    const NON_SPLITTABLE_TAGS = ['sub', 'sup'];

    let innerContent = "";
    // 如果当前标签在豁免名单内，或者父级已经开启了豁免标志，则下级也豁免
    const currentSkipSplitting = skipSplitting || NON_SPLITTABLE_TAGS.includes(tagName);

    Array.from(node.childNodes).forEach((child: any) => {
      innerContent += transformNode(child, getNextId, options, currentSkipSplitting);
    });

    if (!innerContent.trim() && tagName !== 'hr') return "";
    if (BLOCK_TAGS.includes(tagName) || INLINE_TAGS.includes(tagName)) {
      return `<${tagName}>${innerContent}</${tagName}>`;
    }
    if (tagName === 'section') {
      const hasBlock = /<(p|h[1-6]|ul|ol|li|blockquote|table|tr|td|th|hr|pre|img)/i.test(innerContent);
      return hasBlock ? innerContent : `<p>${innerContent}</p>`;
    }
    return innerContent;
  }
  return "";
}

