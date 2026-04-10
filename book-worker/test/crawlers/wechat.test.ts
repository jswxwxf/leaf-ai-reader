import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { parseHTML } from 'linkedom';
import { splitSentences } from '../../src/utils/sentence';
import { cleanHtml } from '../../src/crawlers/wechat';

describe('WeChat Sentence Splitting', () => {
    it('应该正确处理带有书名号和问号的句子，不让收尾符号掉队', () => {
        const text = '《欧洲文明在惧怕谁？》';
        const result = splitSentences(text);
        expect(result).toEqual(['《欧洲文明在惧怕谁？》']);
    });

    it('应该正确处理带有引号的对话', () => {
        const text = '他问：“你好吗？”我回答：“挺好的。”';
        const result = splitSentences(text);
        // 注意：在这种算法下，因为问号后紧跟“我”，没有空格，所以会连在一起
        // 对阅读器来说，对话和其后的说明文字在一起是合理的
        expect(result).toEqual(['他问：“你好吗？”我回答：“挺好的。”']);
    });

    it('应该处理包含双重书名号和问号的长难句', () => {
        const text = '且不说我在《《指环王》密码（上）：欧洲文明在惧怕谁？》系列开篇就已经解释了托尔金所处的时代给他的难言之隐';
        const result = splitSentences(text);
        expect(result).toEqual(['且不说我在《《指环王》密码（上）：欧洲文明在惧怕谁？》系列开篇就已经解释了托尔金所处的时代给他的难言之隐']);
    });

    it('应该正确处理标准的句号断句', () => {
        const text = '第一句。 第二句。';
        const result = splitSentences(text);
        expect(result).toEqual(['第一句。', '第二句。']);
    });

    it('不应该将换行符之后的内容强行合并', () => {
        const text = '第一句。\n第二句。';
        const result = splitSentences(text);
        expect(result).toEqual(['第一句。', '第二句。']);
    });

    it('应该处理普通的无标点文本', () => {
        const text = '没有标点的段落';
        const result = splitSentences(text);
        expect(result).toEqual(['没有标点的段落']);
    });
});

describe('WeChat Crawler cleanHtml', () => {
    // it('应该能正确处理 test.html 并生成 output.html', () => {
    //     const htmlPath = resolve(__dirname, 'test.html');
    //     const outputPath = resolve(__dirname, 'output.html');

    //     const html = readFileSync(htmlPath, 'utf-8');
    //     let { document } = parseHTML(html);

    //     // 处理 Chrome "View Source" 格式
    //     const lineWrap = document.querySelector('.line-wrap');
    //     if (lineWrap) {
    //         const lines = Array.from(document.querySelectorAll('.line-content'));
    //         const originalHtml = lines.map((line: any) => line.textContent).join('\n');
    //         const parsed = parseHTML(originalHtml);
    //         document = parsed.document;
    //     }

    //     const jsContent = document.getElementById('js_content');
    //     expect(jsContent).toBeDefined();

    //     if (jsContent) {
    //         const cleaned = cleanHtml(jsContent);
    //         writeFileSync(outputPath, cleaned, 'utf-8');

    //         expect(cleaned).toContain('class="sentence"');
    //         expect(cleaned).not.toContain('style=');
    //         expect(cleaned).not.toContain('data-src=');
    //     }
    // });

    it('应该正确合并相邻的行内元素而不产生多余的段落', () => {
        const { document } = parseHTML(`
            <div id="js_content">
                <section>
                    <span>上篇《</span>
                    <span>指环王密码</span>
                    <span>》</span>
                </section>
            </div>
        `);
        const jsContent = document.getElementById('js_content');
        const cleaned = cleanHtml(jsContent);

        // 期望值：应该只有一个 <p> 标签包含所有的文本
        const pCount = (cleaned.match(/<p>/g) || []).length;
        expect(pCount).toBe(1);
        // 允许 span 标签存在，所以检查文本内容
        const textOnly = cleaned.replace(/<[^>]+>/g, '');
        expect(textOnly).toContain('上篇《指环王密码》');
    });
});
