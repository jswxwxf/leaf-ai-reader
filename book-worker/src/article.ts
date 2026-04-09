import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { extract } from './crawlers/wechat';


/**
 * 爬虫解析结果接口
 */
export interface CrawlResult {
	title: string;
	content: string;
	source: string;
}

/**
 * 抓取并解析网页文章
 * @param url 目标网页 URL
 * @returns 解析后的文章数据
 */
export async function crawlArticle(url: string): Promise<CrawlResult> {
	// 1. 抓取网页内容
	const response = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
			"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
		},
		// 设置超时，防止 Worker 挂起
		signal: AbortSignal.timeout(10000)
	});

	if (!response.ok) {
		throw new Error(`无法获取网页内容: HTTP ${response.status} ${response.statusText}`);
	}

	const html = await response.text();

	// 2. 使用 linkedom 在内存中构建 DOM
	const { document } = parseHTML(html);

	const isWechat = url.includes("mp.weixin.qq.com") || !!document.getElementById("js_content");

	let title = "";
	let content = "";
	let source = new URL(url).hostname;

	if (isWechat) {
		console.log("[Crawler] Detected Wechat article, using wechat extractor...");
		const result = extract(document);
		if (result) {
			title = result.title;
			content = result.content;
			source = result.source;
		}
	}


	// 4. 兜底方案：如果手动提取失败或不是微信，尝试使用 Readability
	if (!content) {
		console.log("[Crawler] Using Readability as fallback...");
		const reader = new Readability(document);
		const parsed = reader.parse();
		if (parsed) {
			title = title || parsed.title || "无标题";
			content = parsed.content || "";
			source = parsed.siteName || source;
		}

	}

	if (!content) {
		throw new Error("未能从页面中提取到有效的文章正文。");
	}

	console.log(`[Crawler] Extraction successful: "${title}" (${content.length} characters)`);

	return {
		title,
		content,
		source
	};
}
