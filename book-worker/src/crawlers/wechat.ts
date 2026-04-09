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
  clean(jsContent);

  return {
    title,
    content: jsContent.innerHTML.trim(),
    source: "微信公众号"
  };
}

/**
 * 激进清理并重构 HTML
 * 目标：保留核心结构，剔除冗余样式，将文本拆分为带 ID 的 span 句子
 */
function clean(container: any) {
  let sentenceId = 0;
  const getNextId = () => ++sentenceId;

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

  container.innerHTML = fragments.join('\n');
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
      const src = node.getAttribute('data-src') || node.getAttribute('src');
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
 * 分句工具：按标点拆分并保留标点
 */
function splitSentences(text: string): string[] {
  // 匹配：。！？！？ !? \n 以及之后的空格
  const regex = /([^。！？！？!?\n]+[。！？！？!?\n]*)/g;
  const matches = text.match(regex);
  return matches ? matches.map(s => s.trim()).filter(Boolean) : [text.trim()];
}
