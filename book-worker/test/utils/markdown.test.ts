import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import {
  extractMarkdownTitle,
  sanitizeMarkdownHtml,
  splitMarkdownSentences,
  stripMarkdownPrefix,
} from '../../src/utils/markdown';

describe('stripMarkdownPrefix', () => {
  it('removes an ASCII MD prefix at the start of the source', () => {
    expect(stripMarkdownPrefix('MD:\n# 我的文章')).toBe('# 我的文章');
  });

  it('accepts case-insensitive and full-width-colon prefixes', () => {
    expect(stripMarkdownPrefix('md：正文')).toBe('正文');
  });

  it('rejects Markdown with no content after the prefix', () => {
    expect(() => stripMarkdownPrefix('MD:   \n\t')).toThrow('Markdown content is empty');
  });
});

describe('extractMarkdownTitle', () => {
  it('prefers the first level-one ATX heading', () => {
    const tokens = marked.lexer('## 次级标题\n\n# 主标题\n\n正文');

    expect(extractMarkdownTitle(tokens, '临时标题')).toBe('主标题');
  });

  it('does not treat a level-two heading as a level-one ATX heading', () => {
    const tokens = marked.lexer('## 次级标题\n\n正文');

    expect(extractMarkdownTitle(tokens, '临时标题')).toBe('次级标题');
  });

  it('keeps link text but removes its Markdown syntax from an ATX heading', () => {
    const tokens = marked.lexer(
      '# [A Swift Tour](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/guidedtour/)：Swift 编程探索之旅\n\n---\n\n## 1. 启程：Hello, World!'
    );

    expect(extractMarkdownTitle(tokens, '临时标题')).toBe('A Swift Tour：Swift 编程探索之旅');
  });

  it('uses the temporary title when no token contains text', () => {
    const tokens = marked.lexer('---');

    expect(extractMarkdownTitle(tokens, '临时标题')).toBe('临时标题');
  });

  it('limits titles to 50 characters', () => {
    const title = 'a'.repeat(51);
    const tokens = marked.lexer(`# ${title}`);

    expect(extractMarkdownTitle(tokens, '临时标题')).toBe('a'.repeat(50));
  });
});

describe('sanitizeMarkdownHtml', () => {
  it('keeps Markdown semantic structure and safe remote images', () => {
    const sanitized = sanitizeMarkdownHtml(`
      <h1 id="s-1" class="sentence">标题</h1>
      <blockquote><p><strong>强调</strong>文本</p></blockquote>
      <table><thead><tr><th>表头</th></tr></thead><tbody><tr><td>单元格</td></tr></tbody></table>
      <pre><code>const value = 1;</code></pre>
      <img src="https://example.com/image.png" alt="示例图片" loading="lazy">
    `);

    expect(sanitized).toContain('<h1 id="s-1" class="sentence">标题</h1>');
    expect(sanitized).toContain('<blockquote><p><strong>强调</strong>文本</p></blockquote>');
    expect(sanitized).toContain('<table>');
    expect(sanitized).toContain('<pre><code>const value = 1;</code></pre>');
    expect(sanitized).toContain('src="https://example.com/image.png"');
    expect(sanitized).toContain('alt="示例图片"');
  });

  it('removes links and active content while preserving link text', () => {
    const sanitized = sanitizeMarkdownHtml(`
      <p style="color:red" onclick="alert(1)"><a href="https://example.com">链接文字</a></p>
      <script>alert(1)</script><iframe src="https://example.com"></iframe>
      <form><input name="password"></form>
    `);

    expect(sanitized).toContain('链接文字');
    expect(sanitized).not.toContain('<a');
    expect(sanitized).not.toContain('href=');
    expect(sanitized).not.toContain('style=');
    expect(sanitized).not.toContain('onclick=');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('<iframe');
    expect(sanitized).not.toContain('<form');
    expect(sanitized).not.toContain('<input');
  });

  it('removes images that do not use absolute http(s) URLs', () => {
    const sanitized = sanitizeMarkdownHtml(`
      <img src="https://example.com/safe.png">
      <img src="/relative.png">
      <img src="data:image/png;base64,abc">
      <img src="javascript:alert(1)">
      <img src="file:///tmp/image.png">
    `);

    expect(sanitized).toContain('src="https://example.com/safe.png"');
    expect(sanitized).not.toContain('relative.png');
    expect(sanitized).not.toContain('data:image');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('file:///');
  });

  it('removes inline code markup while preserving fenced code blocks', () => {
    const sanitized = sanitizeMarkdownHtml(`
      <p>使用 <code>let</code> 声明常量，使用 <code>var</code> 声明变量。</p>
      <pre><code class="language-swift">let implicitInteger = 70</code></pre>
    `);

    expect(sanitized).toContain('<p>使用 let 声明常量，使用 var 声明变量。</p>');
    expect(sanitized).not.toContain('<p>使用 <code>');
    expect(sanitized).toContain('<pre><code class="language-swift">let implicitInteger = 70</code></pre>');
  });
});

describe('splitMarkdownSentences', () => {
  it('adds continuous sentence ids to readable Markdown blocks', () => {
    const result = splitMarkdownSentences(`
      <h1>标题。</h1>
      <p>第一句。第二句。</p>
      <ul><li>列表项。</li></ul>
      <blockquote>引用句。</blockquote>
    `);

    expect(result).toContain('<h1><span class="sentence" id="s-1">标题。</span></h1>');
    expect(result).toContain('<p><span class="sentence" id="s-2">第一句。</span><span class="sentence" id="s-3">第二句。</span></p>');
    expect(result).toContain('<li><span class="sentence" id="s-4">列表项。</span></li>');
    expect(result).toContain('<blockquote><span class="sentence" id="s-5">引用句。</span></blockquote>');
  });

  it('preserves inline markup and skips code, tables, images, and existing sentence spans', () => {
    const result = splitMarkdownSentences(`
      <p>普通<strong>强调</strong>文本。</p>
      <pre><code>const value = "代码。";</code></pre>
      <table><tbody><tr><td>表格句。</td></tr></tbody></table>
      <p><img src="https://example.com/image.png">图片旁文本。</p>
      <p><span class="sentence" id="s-existing">已有句子。</span></p>
    `);

    expect(result).toContain('<strong><span class="sentence" id="s-2">强调</span></strong>');
    expect(result).toContain('<code>const value = "代码。";</code>');
    expect(result).toContain('<td>表格句。</td>');
    expect(result).toContain('<img src="https://example.com/image.png">');
    expect(result).toContain('<span class="sentence" id="s-existing">已有句子。</span>');
    expect(result).not.toContain('id="s-3">代码。');
    expect(result).not.toContain('id="s-3">表格句。');
  });
});
