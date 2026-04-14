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

    it('应该正确处理中文分号断句', () => {
        const text = '第一句；第二句。';
        const result = splitSentences(text);
        expect(result).toEqual(['第一句；', '第二句。']);
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
    it('应该正确清洗包含多个 span 和 leaf 属性的复杂微信 HTML (用户请求测试)', () => {
        const inputHtml = `
            <div id="js_content">
                <p style="margin-left: 8px; margin-right: 8px; text-align: justify; line-height: 1.75em; visibility: visible;"><span style="font-family: 微软雅黑; font-size: 16px; visibility: visible;" mpa-font-style="mnwzzv6ib6h"><font face="微软雅黑" style="visibility: visible;"><span leaf="" style="visibility: visible;"><span textstyle="" style="letter-spacing: 1px; visibility: visible;">为啥我说这些人观念朴素呢？一个关键问题，线下店到底是怎么丢掉自己的优势的？如果去过中关村之前的那几个电脑城，或者你在线下店买到的东西出了问题，你才能意识到线上店的优势有多大，那些被迫关闭的线下商场，没一个是冤枉的。</span></span></font></span></p>
            </div>
        `;
        const { document } = parseHTML(inputHtml);
        const jsContent = document.getElementById('js_content');
        const cleaned = cleanHtml(jsContent);

        const expected = '<p><span class="sentence" id="s-1">为啥我说这些人观念朴素呢？</span><span class="sentence" id="s-2">一个关键问题，线下店到底是怎么丢掉自己的优势的？</span><span class="sentence" id="s-3">如果去过中关村之前的那几个电脑城，或者你在线下店买到的东西出了问题，你才能意识到线上店的优势有多大，那些被迫关闭的线下商场，没一个是冤枉的。</span></p>';

        expect(cleaned).toBe(expected);
    });


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

        const expected = '<p><span class="sentence" id="s-1">上篇《指环王密码》</span></p>';
        expect(cleaned).toBe(expected);

    });

    it('应该正确清洗微信典型的复杂嵌套 HTML 并合并被切断的句子', () => {
        const messyHtml = `
            <div id="js_content">
                <p style="margin-left: 16px;margin-right: 16px;"><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;">西北大学</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;">终于站出来了，此时，离</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;">我周一</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;">发的</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;">《</span><a href="https://mp.weixin.qq.com/s..."><span textstyle="" style="font-size: 16px;">一觉醒来，贾浅浅终于变成董小姐了</span></a><span textstyle="" style="font-size: 16px;">》</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;">已经三天。在这篇文章中，</span><span textstyle="" style="font-size: 16px;font-weight: bold;">我</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;font-weight: bold;">把小贾论文抄袭这事上升到</span></span></font><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;font-weight: bold;">“董小姐同类腐败链</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;font-weight: bold;">“</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;font-weight: bold;">的高度，</span></span></font></span><span style="font-family: 宋体;font-size: 10.5pt;"><font face="宋体"><span leaf=""><span textstyle="" style="font-size: 16px;font-weight: bold;">目的就是推进议程。</span></span></font></span></p>
            </div>
        `;
        const { document } = parseHTML(messyHtml);
        const jsContent = document.getElementById('js_content');
        const cleaned = cleanHtml(jsContent);

        const expected = '<p><span class="sentence" id="s-1">西北大学终于站出来了，此时，离我周一发的《一觉醒来，贾浅浅终于变成董小姐了》已经三天。</span><span class="sentence" id="s-2">在这篇文章中，我把小贾论文抄袭这事上升到“董小姐同类腐败链“的高度，目的就是推进议程。</span></p>';

        expect(cleaned).toBe(expected);
    });


    it('应该正确清洗带有 section 和 leaf 属性的复杂微信 HTML', () => {
        const inputHtml = `
            <div id="js_content">
                <section style="margin-left: 16px;margin-right: 16px;line-height: 1.75em;margin-bottom: 20px;"><span style="font-family: 宋体;font-size: 17px;color: rgb(65, 70, 75);"><span leaf="">我能想象他们的心情，这帮人读我文章时，一定是非常高傲的，他们一定不断默念着：“作者就是个傻叉，我比他懂《指环王》多了，我就是要跟他抬杠一下，证明这一点！”</span></span></section>
                <section style="margin-left: 16px;margin-right: 16px;line-height: 1.75em;margin-bottom: 20px;"><span style="color: rgb(65, 70, 75);"><span style="font-family: 宋体;font-size: 17px;"><span leaf="">好吧，可能我不如您懂指环王。但我要说：</span></span><strong><span style="font-family: 宋体;"><span leaf="">一个人若以这种高傲的心态去读书览文，看的再多也只是在浪费时间。</span></span></strong></span></section>
                <section style="margin-left: 16px;margin-right: 16px;line-height: 1.75em;margin-bottom: 20px;"><span style="font-family: 宋体;font-size: 17px;color: rgb(65, 70, 75);"><span leaf="">因为骄傲会封闭你的大脑和内心，让你无法获得新启发和新知识。</span></span></section>
                <section style="margin-left: 16px;margin-right: 16px;line-height: 1.75em;margin-bottom: 20px;"><span style="color: rgb(65, 70, 75);font-family: 宋体;"><span leaf="">抛开成见，请思考一下，《指环王》之中有没有历史的影子呢？</span></span></section>
                <section style="margin-left: 16px;margin-right: 16px;line-height: 1.75em;margin-bottom: 20px;"><span style="font-family: 宋体;color: rgb(65, 70, 75);"><span leaf="">当然是有的。</span></span></section>
            </div>
        `;
        const { document } = parseHTML(inputHtml);
        const jsContent = document.getElementById('js_content');
        const cleaned = cleanHtml(jsContent);

        const expected = `<p><span class="sentence" id="s-1">我能想象他们的心情，这帮人读我文章时，一定是非常高傲的，他们一定不断默念着：“作者就是个傻叉，我比他懂《指环王》多了，我就是要跟他抬杠一下，证明这一点！”</span></p>
<p><span class="sentence" id="s-2">好吧，可能我不如您懂指环王。</span><span class="sentence" id="s-3">但我要说：</span><strong><span class="sentence" id="s-4">一个人若以这种高傲的心态去读书览文，看的再多也只是在浪费时间。</span></strong></p>
<p><span class="sentence" id="s-5">因为骄傲会封闭你的大脑和内心，让你无法获得新启发和新知识。</span></p>
<p><span class="sentence" id="s-6">抛开成见，请思考一下，《指环王》之中有没有历史的影子呢？</span></p>
<p><span class="sentence" id="s-7">当然是有的。</span></p>`;

        expect(cleaned).toBe(expected);

    });

    it('应该正确清洗包含 Light Phone 评价的复杂微信 HTML (用户请求测试)', () => {
        const inputHtml = `
            <div id="js_content">
                <p><span leaf=""><span textstyle="" style="letter-spacing: normal;">海外媒体是这么评价 Light Phone 三代的：「极简主义被拉伸到令人沮丧的程度」，「一台越来越像智能机的傻瓜手机」。也不能怪他们：AMOLED 屏幕、摄像头、NFC 支付、指纹解锁……只看参数表的话，你很容易以为这就是一台智能机。</span></span></p>
            </div>
        `;
        const { document } = parseHTML(inputHtml);
        const jsContent = document.getElementById('js_content');
        const cleaned = cleanHtml(jsContent);

        const expected = '<p><span class="sentence" id="s-1">海外媒体是这么评价 Light Phone 三代的：「极简主义被拉伸到令人沮丧的程度」，「一台越来越像智能机的傻瓜手机」。</span><span class="sentence" id="s-2">也不能怪他们：AMOLED 屏幕、摄像头、NFC 支付、指纹解锁……</span><span class="sentence" id="s-3">只看参数表的话，你很容易以为这就是一台智能机。</span></p>';

        expect(cleaned).toBe(expected);
    });

});

