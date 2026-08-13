import { parseHTML } from 'linkedom';
import createDOMPurify from 'dompurify';
import { marked, type Token, type Tokens } from 'marked';
import { createSentenceWrapper } from './sentence';

const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
const DOMPurify = createDOMPurify(window as any);

export interface ProcessedMarkdownArticle {
  title: string;
  content: string;
}

/**
 * Markdown 导入处理管线。
 *
 * TODO: 实现下列步骤，并确保任一步失败时不返回半成品 HTML。
 */
export function processMarkdownArticle(
  rawText: string,
  fallbackTitle: string
): ProcessedMarkdownArticle {
  const markdown = stripMarkdownPrefix(rawText);
  const tokens = marked.lexer(markdown);
  const title = extractMarkdownTitle(tokens, fallbackTitle);
  const compiledHtml = compileMarkdown(tokens);
  const sanitizedHtml = sanitizeMarkdownHtml(compiledHtml);
  const content = splitMarkdownSentences(sanitizedHtml);

  return { title, content };
}

/** 移除位于原文开头的 `MD:` / `MD：` 前缀，并拒绝空内容。 */
export function stripMarkdownPrefix(rawText: string): string {
  const markdown = rawText.replace(/^md[:：]\s*/i, '');

  if (!markdown.trim()) {
    throw new Error('Markdown content is empty');
  }

  return markdown;
}

/** 提取首个一级 ATX 标题；缺失时取首个带文字的 token 作为回退标题。 */
export function extractMarkdownTitle(tokens: Token[], fallbackTitle: string): string {
  // 优先匹配首个一级 ATX 标题 `# 标题`，不将 `##` 识别为一级。
  const atxHeading = tokens.find((token): token is Tokens.Heading =>
    token.type === 'heading'
    && token.depth === 1
    && /^ {0,3}#(?!#)(?:[ \t]+|$)/.test(token.raw)
  );
  // 没有一级标题时，依次取首个带文字的 token。
  const title = atxHeading?.tokens
    .map(token => 'text' in token ? token.text : '')
    .join('')
    .trim() || tokens
    .map(token => 'text' in token ? token.text.trim() : '')
    .find(Boolean);

  // 标题截断为 50 字符；无可见文字则沿用传入的临时标题。
  return title?.slice(0, 50) || fallbackTitle;
}

/** 使用与标题提取共享的 token 编译 Markdown（含 GFM）HTML。 */
function compileMarkdown(tokens: Token[]): string {
  return marked.parser(tokens);
}

/**
 * 使用 Markdown 专用安全策略净化编译后的 HTML。
 *
 * 链接标签会移除而文字保留；仅保留绝对 http(s) 图片地址。
 */
export function sanitizeMarkdownHtml(html: string): string {
  // 使用 Markdown 专用标签/属性白名单，保留标题、列表、表格、引用、代码、
  // 图片及 sentence span 所需属性。
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'span', 'strong', 'b', 'em', 'i', 'sub', 'sup', 'del',
      'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'hr', 'pre', 'code', 'img', 'br',
    ],
    // 不允许 <a>，因此链接标签会移除而文字保留。
    // 未列入白名单的脚本、事件属性、内联样式、iframe、表单和主动内容也会移除。
    ALLOWED_ATTR: ['id', 'class', 'src', 'alt', 'loading'],
  });

  const { document } = parseHTML(`<!DOCTYPE html><html><body>${sanitizedHtml}</body></html>`);
  const allowedTags = new Set([
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'hr', 'pre', 'code', 'img', 'br',
  ]);
  const removeWithContent = new Set([
    'script', 'style', 'noscript', 'template', 'iframe', 'form', 'input', 'button',
    'select', 'textarea', 'option', 'video', 'audio', 'source', 'track', 'embed',
    'object', 'svg', 'math', 'canvas',
  ]);

  Array.from(document.body.querySelectorAll('*')).forEach((element: any) => {
    const tag = element.tagName.toLowerCase();

    // 移除内联 <code> 标签但保留文字；<pre><code> 代码块及其语言 class 保持不变。
    if (tag === 'code' && element.parentElement?.tagName.toLowerCase() !== 'pre') {
      while (element.firstChild) {
        element.parentNode?.insertBefore(element.firstChild, element);
      }
      element.remove();
      return;
    }

    // 不允许 <a>，因此链接标签会移除而文字保留。
    if (tag === 'a' || !allowedTags.has(tag)) {
      if (removeWithContent.has(tag)) {
        element.remove();
        return;
      }

      while (element.firstChild) {
        element.parentNode?.insertBefore(element.firstChild, element);
      }
      element.remove();
      return;
    }

    // 未列入白名单的事件属性、内联样式和其他属性会移除。
    const allowedAttributes = tag === 'img'
      ? new Set(['id', 'class', 'src', 'alt', 'loading'])
      : tag === 'code' && element.parentElement?.tagName.toLowerCase() === 'pre'
        ? new Set(['id', 'class'])
      : new Set(['id', 'class']);
    Array.from(element.attributes).forEach((attribute: any) => {
      if (!allowedAttributes.has(attribute.name.toLowerCase())) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  // 对净化结果二次检查图片地址：仅保留绝对 http: / https: 的 img.src；
  // 相对、本地、data:、javascript: 等图片会整体移除。
  document.querySelectorAll('img').forEach((image: any) => {
    const src = image.getAttribute('src') || '';

    try {
      const url = new URL(src);
      if (!['http:', 'https:'].includes(url.protocol)) {
        image.remove();
      }
    } catch {
      image.remove();
    }
  });

  return document.body.innerHTML;
}

/**
 * 在 Markdown 的可朗读文本块中注入连续的 sentence span。
 *
 * 仅处理 p、h1-h6、li、blockquote 内的普通文本节点；代码、表格、图片及
 * 已有 sentence span 不参与分句，以保留它们的原始结构。
 */
export function splitMarkdownSentences(html: string): string {
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  // 使用共享的 createSentenceWrapper()，继续复用原有分句规则。
  const sentenceWrapper = createSentenceWrapper();
  // 仅对 p、h1–h6、li、blockquote 的普通文本节点注入连续 s-N sentence span。
  const readableBlockSelector = 'p, h1, h2, h3, h4, h5, h6, li, blockquote';
  // 跳过 pre 代码块、表格及单元格、图片、已有 .sentence。
  // 内联 code 已在净化阶段移除，其文字由共享分句规则正常处理。
  const excludedSelector = 'pre, table, thead, tbody, tr, td, th, img, .sentence';

  document.body.querySelectorAll(readableBlockSelector).forEach((block: any) => {
    const textNodes: any[] = [];
    const collectTextNodes = (node: any) => {
      Array.from(node.childNodes).forEach((child: any) => {
        if (child.nodeType === 3) {
          textNodes.push(child);
          return;
        }

        // 递归行内元素的子节点，保留内联格式结构。
        if (child.nodeType === 1 && !child.matches(excludedSelector)) {
          collectTextNodes(child);
        }
      });
    };

    collectTextNodes(block);

    textNodes.forEach((textNode) => {
      const sentenceHtml = sentenceWrapper(textNode.textContent || '');
      if (!sentenceHtml) return;

      const { document: fragmentDocument } = parseHTML(
        `<!DOCTYPE html><html><body>${sentenceHtml}</body></html>`
      );
      const fragment = document.createDocumentFragment();
      while (fragmentDocument.body.firstChild) {
        fragment.appendChild(fragmentDocument.body.firstChild);
      }
      textNode.replaceWith(fragment);
    });
  });

  return document.body.innerHTML;
}
