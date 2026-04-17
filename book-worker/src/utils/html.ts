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

  // 1. 结构平坦化
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

    const isBlock = /^\s*<(p|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|table|hr|pre)/i.test(html);

    if (isBlock) {
      flushBuffer();
      fragments.push(html.trim());
    } else {
      inlineBuffer.push(html);
    }
  });

  flushBuffer();

  const rawHtml = fragments.join('\n');

  // 2. 安全净化
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'span', 'strong', 'b', 'em', 'i', 'sub', 'sup', 'del',
      'ul', 'ol', 'li', 'blockquote', 'table', 'tr', 'td', 'th', 'hr', 'pre', 'code',
      'img'
    ],
    ALLOWED_ATTR: ['id', 'class', 'src', 'alt', 'loading'],
  });
}

function normalizeStructure(container: any) {
  const tagsToStrip = ['span', 'font', 'div', 'fieldset', 'a'];
  const walk = (node: any) => {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === 3 && !child.textContent.trim()) {
        node.removeChild(child);
      } else if (child.nodeType === 1) {
        walk(child);
        const tag = child.tagName.toLowerCase();
        const isSimpleDiv = tag === 'div' && !child.id && !child.className;
        if (tagsToStrip.includes(tag) && (tag !== 'div' || isSimpleDiv)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
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

function transformNode(node: any, getNextId: () => number, options?: { bookId?: string, path?: string }): string {
  if (node.nodeType === 3) {
    const text = node.textContent || "";
    if (!text.trim()) return "";
    if (/^\s+$/.test(text) && text.includes('\n')) return " ";
    
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
    if (tagName === 'br') return "";

    const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'tr', 'td', 'th', 'hr', 'pre', 'code'];
    const INLINE_TAGS = ['strong', 'b', 'em', 'i', 'sub', 'sup', 'del'];

    let innerContent = "";
    Array.from(node.childNodes).forEach((child: any) => {
      innerContent += transformNode(child, getNextId, options);
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

