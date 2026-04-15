import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { extract } from '../../src/crawlers/wechat';

describe('WeChat JS Content Extraction', () => {
    it('应该能从包含 JsDecode 的 HTML 源码中提取正文', () => {
        const rawHtml = `
            <html>
                <head>
                    <meta property="og:title" content="测试标题" />
                </head>
                <body>
                    <div id="js_content"></div>
                    <script>
                        window.text_page_info = {
                            content: JsDecode('第一段内容\\x0a\\x0a第二段内容带有转义\\x22引号\\x22'),
                        };
                    </script>
                </body>
            </html>
        `;

        const { document } = parseHTML(rawHtml);
        const result = extract(document, rawHtml);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('测试标题');
        // 验证正文是否被正确解码并包装
        expect(result?.content).toContain('第一段内容');
        expect(result?.content).toContain('第二段内容带有转义"引号"');
        expect(result?.content).toContain('class="sentence"');
        expect(result?.content).toContain('id="s-1"');
    });

    it('如果 DOM 中已有 js_content，则应优先使用 DOM 提取', () => {
        const rawHtml = `
            <html>
                <body>
                    <div id="js_content"><p>DOM内容</p></div>
                    <script>
                        content: JsDecode('JS内容'),
                    </script>
                </body>
            </html>
        `;

        const { document } = parseHTML(rawHtml);
        const result = extract(document, rawHtml);

        expect(result?.content).toContain('DOM内容');
        expect(result?.content).not.toContain('JS内容');
    });
});
