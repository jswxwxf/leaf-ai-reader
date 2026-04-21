import { parseHTML } from 'linkedom';
import { extract as wechatExtract } from './crawlers/wechat';
import { cleanHtml } from './utils/html';

/**
 * 爬虫解析结果接口
 */
export interface CrawlResult {
	title: string;
	content: string;
	source: string;
}

/**
 * 自动识别并解码 HTML 内容
 */
async function decodeResponse(response: Response): Promise<string> {
	const buffer = await response.arrayBuffer();
	const contentType = response.headers.get("content-type") || "";

	// 1. 尝试从响应头获取编码
	let charset = contentType.match(/charset=([^;]+)/i)?.[1];

	// 2. 如果 Header 没有，尝试从字节流前 2048 字节中匹配 meta 标签
	if (!charset) {
		const preview = new TextDecoder("ascii").decode(buffer.slice(0, 2048));
		charset = preview.match(/<meta[^>]+charset=["']?([^"'>\s]+)["']?/i)?.[1] ||
			preview.match(/charset=["']?([^"'>\s]+)["']?/i)?.[1];
	}

	// 默认使用 utf-8，但对 GBK/GB2312 网站进行纠正
	charset = charset?.toLowerCase() || "utf-8";
	if (charset === "gb2312" || charset === "gb18030") charset = "gbk";

	try {
		return new TextDecoder(charset).decode(buffer);
	} catch (e) {
		console.warn(`[Crawler] Failed to decode with ${charset}, falling back to utf-8`);
		return new TextDecoder("utf-8").decode(buffer);
	}
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
		signal: AbortSignal.timeout(10000)
	});

	if (!response.ok) {
		throw new Error(`无法获取网页内容: HTTP ${response.status} ${response.statusText}`);
	}

	const html = await decodeResponse(response);

	// 2. 使用 linkedom 在内存中构建 DOM
	const { document } = parseHTML(html);

	const urlObj = new URL(url);
	const isWechat = urlObj.hostname.includes("mp.weixin.qq.com") || !!document.getElementById("js_content");

	let title = "";
	let content = "";
	let source = urlObj.hostname;

	// 3. 提取标题 (优先从 meta 或特定 ID 获取)
	title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
		document.getElementById("activity-name")?.textContent?.trim() ||
		document.querySelector('h1')?.textContent?.trim() ||
		document.title?.trim() ||
		"无标题文章";

	// 4. 定位正文容器
	let contentElement: any = null;

	if (isWechat) {
		// 微信特化逻辑
		const result = wechatExtract(document, html);
		if (result) {
			title = result.title || title;
			content = result.content;
			source = result.source;
		}
	} else {
		// 通用网站方案：尝试常见正文容器选择器
		const selectors = [
			'article',
			'main',
			'[role="main"]',
			'#js_content', // 即使不是微信域名，如果有这个 ID 也优先使用
			'#main-content',
			'#content',
			'#main',
			'.article',
			'.post-content',
			'.content'
		];

		for (const selector of selectors) {
			const el = document.querySelector(selector);
			// 简单的启发式规则：内容长度显著才认为找到了正文
			if (el && el.textContent.trim().length > 200) {
				contentElement = el;
				break;
			}
		}

		// 极端兜底：如果都没找到，使用 body
		if (!contentElement) {
			contentElement = document.body;
		}

		// 使用通用的 cleanHtml 进行清洗和数字化（分句）
		content = cleanHtml(contentElement);
	}

	if (!content || content.trim().length < 50) {
		throw new Error("未能从页面中提取到有效的文章正文。");
	}

	console.log(`[Crawler] Extraction successful: "${title}" (${content.length} characters)`);

	return {
		title,
		content,
		source
	};
}
