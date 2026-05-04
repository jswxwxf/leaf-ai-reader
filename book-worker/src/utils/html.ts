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

  let refined = html;
  let previousHtml: string;

  do {
    previousHtml = refined;
    refined = refined
      // 1. Span 提升 (Span Promotion)
      // 将 <b><span class="sentence" id="s-N">文本</span></b> 转换为 <span class="sentence" id="s-N"><b>文本</b></span>
      // 循环执行可处理 <em><strong><span>...</span></strong></em> 这类多层行内样式。
      .replace(/<(strong|b|em|i|del|a)([^>]*)>\s*<span class="sentence" id="s-(\d+)">(.*?)<\/span>\s*<\/\1>/gi, '<span class="sentence" id="s-$3"><$1$2>$4</$1></span>');
  } while (refined !== previousHtml);

  const polished = refined
    // 2. 句子缝合 (Sentence Healing)
    // transformNode 是按 text node 分句的；微信正文又常把同一句拆进多个行内标签。
    // 所以这里把“前一个 sentence span 还没到句末”的相邻 span 合并回去。
    //
    // 注意：不要只看 `</span>` 前一个字符。
    // 例如 `<span>...。</b></span><span>下一句</span>` 中，`</span>` 前是 `>`，
    // 但真正的文本结尾是 `。`。因此正则只定位相邻 span，是否合并交给可见文本判断。
    .replace(/<\/span>(\s*(?:<br\s*\/?>|<sup>.*?<\/sup>|<sub>.*?<\/sub>|\s)*)<span class="sentence" id="s-\d+">/gi, (match, separator, offset, fullHtml) => {
      const htmlBeforeBoundary = fullHtml.slice(0, offset);
      const previousSpanStart = htmlBeforeBoundary.lastIndexOf('<span class="sentence"');
      const previousSentenceHtml = previousSpanStart >= 0 ? htmlBeforeBoundary.slice(previousSpanStart) : htmlBeforeBoundary;

      return shouldHealSentence(previousSentenceHtml) ? separator : match;
    })

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

  return balanceSentenceInlineTags(polished);
}

function shouldHealSentence(sentenceHtml: string): boolean {
  // 只看可见文本最后一个字符，避免被 </b>、</strong> 这类标签结尾误导。
  const textContent = sentenceHtml.replace(/<[^>]*>/g, '').trim();
  if (!textContent) return false;

  const lastChar = Array.from(textContent).pop();
  const sentenceBoundaryChars = '。！？；：!?….;”’』」》）〉】〗｝"\')]}:';
  return !lastChar || !sentenceBoundaryChars.includes(lastChar);
}

function balanceSentenceInlineTags(html: string): string {
  const balanceBlock = (blockHtml: string) => {
    const activeTags: string[] = [];

    return blockHtml.replace(/<span class="sentence" id="s-(\d+)">([\s\S]*?)<\/span>/g, (_match, id, content) => {
      const balancedContent = balanceSentenceContent(content, activeTags);
      return `<span class="sentence" id="s-${id}">${balancedContent}</span>`;
    });
  };

  return html.replace(/<(p|h[1-6]|li|blockquote|td|th)>([\s\S]*?)<\/\1>/gi, (_match, tag, content) => {
    return `<${tag}>${balanceBlock(content)}</${tag}>`;
  });
}

function balanceSentenceContent(content: string, activeTags: string[]): string {
  const tagPattern = /<\/?(strong|b|em|i|del)\b[^>]*>/gi;
  let output = activeTags.map(tag => `<${tag}>`).join('');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(content)) !== null) {
    output += content.slice(lastIndex, match.index);

    const rawTag = match[0];
    const tagName = match[1].toLowerCase();

    if (rawTag.startsWith('</')) {
      const lastOpenIndex = activeTags.lastIndexOf(tagName);
      if (lastOpenIndex >= 0) {
        while (activeTags.length > lastOpenIndex) {
          const closedTag = activeTags.pop();
          if (closedTag) output += `</${closedTag}>`;
        }
      }
    } else {
      activeTags.push(tagName);
      output += rawTag;
    }

    lastIndex = tagPattern.lastIndex;
  }

  output += content.slice(lastIndex);
  output += [...activeTags].reverse().map(tag => `</${tag}>`).join('');

  return output;
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
