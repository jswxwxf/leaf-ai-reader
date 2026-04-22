/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { WorkerEntrypoint } from "cloudflare:workers";
import { EpubParser } from "./epub";
import { crawlArticle } from "./article";
import { parseHTML } from 'linkedom';
import * as fflate from 'fflate';
import { normalizeChapters, flattenChapters } from './utils/chapter';
import { cleanHtml } from './utils/html';
import { toCompactText, generateSummary } from "./utils/summary";

export default class extends WorkerEntrypoint<Env> {
	/**
	 * 处理 HTTP 请求，防止部署报错并支持基础的状态验证。
	 */
	async fetch(request: Request): Promise<Response> {
		// const url = new URL(request.url);
		// if (url.pathname === "/debug") {
		// 	const userId = "local-dev";
		// 	const bookId = "fb0aefba-28e0-44e6-ae1c-5f597fb2177d";
		// 	const chapterPath = 'text00028.html'
		// 	try {
		// 		const result = await this.processChapter(userId, bookId, chapterPath);
		// 		return Response.json(result);
		// 	} catch (e: any) {
		// 		return new Response(e.message, { status: 500 });
		// 	}
		// }

		return new Response("Leaf Book Worker is running.", {
			headers: { "Content-Type": "text/plain;charset=UTF-8" },
		});
	}


	/**
	 * 处理图书：仅从 R2 读取文件，解析元数据，提取封面。
	 * 暂时屏蔽 D1 数据库操作以排查环境问题。
	 */
	async processBook(userId: string, bookId: string) {
		const epubKey = `books/${userId}/${bookId}/original.epub`;

		console.log(`[Indexer] Starting to process book ${bookId} for user ${userId}`);

		// 1. 获取 EPUB
		const object = await this.env.LEAF_BOOK_BUCKET.get(epubKey);
		if (!object) {
			throw new Error(`EPUB not found in R2: ${epubKey}`);
		}

		// 2. 加载与解析
		const buffer = await object.arrayBuffer();
		const parser = new EpubParser();
		await parser.load(buffer);

		const metadata = await parser.parse();

		// 3. 提取并保存封面图 (如果存在)
		let updatedCoverKey: string | null = null;
		if (metadata.coverPath) {
			const coverBuffer = await parser.getFile(metadata.coverPath, "uint8array");
			if (coverBuffer) {
				// 根据 MIME 类型确定扩展名
				const mimeMap: Record<string, string> = {
					"image/jpeg": "jpg",
					"image/png": "png",
					"image/gif": "gif",
					"image/webp": "webp",
					"image/svg+xml": "svg",
				};
				const extension = mimeMap[metadata.coverMime || ""] || "jpg";
				const coverR2Key = `books/${userId}/${bookId}/cover.${extension}`;

				await this.env.LEAF_BOOK_BUCKET.put(coverR2Key, coverBuffer, {
					httpMetadata: { contentType: metadata.coverMime || "image/jpeg" },
				});
				updatedCoverKey = coverR2Key;
				console.log(`[Indexer] Extracted and saved cover to ${coverR2Key} as ${metadata.coverMime}`);
			}
		}

		console.log(`[Indexer] Successfully parsed book: ${metadata.title}`);

		// 4.1 规范化并上传目录 (TOC) 到 R2
		const normalizedChapters = normalizeChapters(metadata.chapters);
		const tocR2Key = `books/${userId}/${bookId}/toc.json`;
		await this.env.LEAF_BOOK_BUCKET.put(tocR2Key, JSON.stringify(normalizedChapters), {
			httpMetadata: { contentType: "application/json" },
		});

		// 4.1.2 展平章节并上传到 R2
		const flattenedChapters = flattenChapters(normalizedChapters);
		const flattenTocR2Key = `books/${userId}/${bookId}/flatten-chapters.json`;
		await this.env.LEAF_BOOK_BUCKET.put(flattenTocR2Key, JSON.stringify(flattenedChapters), {
			httpMetadata: { contentType: "application/json" },
		});

		console.log(`[Indexer] Successfully uploaded toc.json and flatten-chapters.json`);

		// 4.2 更新书籍元数据
		try {
			await this.env.LEAF_BOOK_DB.prepare(
				`UPDATE books 
				 SET title = ?, 
				     author = ?, 
					 published_at = ?,
					 cover_r2_key = ?, 
					 root_dir = ?,
					 status = 'ready' 
				 WHERE id = ? AND user_id = ?`
			).bind(
				metadata.title,
				metadata.author,
				metadata.publishDate,
				updatedCoverKey,
				metadata.rootDir,
				bookId,
				userId
			).run();
			console.log(`[Indexer] Database update successful for book ${bookId}`);
		} catch (e: any) {
			console.error(`[Indexer] Database update failed for book ${bookId}: ${e.message}`);
			throw new Error(`Database update failed: ${e.message}`);
		}

		return {
			success: true,
			body: {
				title: metadata.title,
				author: metadata.author,
				publishedAt: metadata.publishDate,
				coverR2Key: updatedCoverKey,
			}
		};
	}

	async processChapter(userId: string, bookId: string, chapterPath: string) {
		console.log(`[Worker] Started pure processing for: book=${bookId}, path=${chapterPath}`);

		const contentKey = `books/${userId}/${bookId}/content/${chapterPath}`;

		// 1. 从 D1 获取该书的物理根目录 (root_dir)
		const book = await this.env.LEAF_BOOK_DB.prepare(
			"SELECT root_dir FROM books WHERE id = ?"
		).bind(bookId).first<{ root_dir: string }>();

		const rootDir = book?.root_dir || "";

		// 2. 从 R2 读取原文
		const epubKey = `books/${userId}/${bookId}/original.epub`;
		const epubObject = await this.env.LEAF_BOOK_BUCKET.get(epubKey);
		if (!epubObject) throw new Error(`[Worker] EPUB not found: ${epubKey}`);

		const epubBuffer = await epubObject.arrayBuffer();
		const uint8Array = new Uint8Array(epubBuffer);

		// 3. 解压并提取指定 HTML
		const decodedPath = decodeURIComponent(chapterPath);
		// 拼接真实全路径 (rootDir + decodedPath)
		const fullPath = rootDir + decodedPath;

		const unzipped = fflate.unzipSync(uint8Array, {
			filter: (file) => file.name === fullPath
		});

		const chapterFile = unzipped[fullPath];
		if (!chapterFile) {
			console.log("[Worker] ZIP Files available (partial):", Object.keys(unzipped).slice(0, 5));
			throw new Error(`[Worker] Chapter file not found at: ${fullPath}`);
		}

		// 3. 清洗且分句
		const htmlContent = new TextDecoder().decode(chapterFile);
		const { document } = parseHTML(htmlContent);
		const processedHtml = cleanHtml(document.body || document, {
			bookId,
			path: decodedPath
		});

		// 4. 存回 R2
		await this.env.LEAF_BOOK_BUCKET.put(contentKey, processedHtml, {
			httpMetadata: { contentType: 'text/html; charset=utf-8' }
		});

		// 5. 写入摘要占位符
		const summaryKey = `${contentKey}.summary.json`;
		await this.env.LEAF_BOOK_BUCKET.put(summaryKey, JSON.stringify({ summaries: [] }), {
			httpMetadata: { contentType: 'application/json; charset=utf-8' }
		});
		console.log(`[Worker] Chapter processing done (summary skipped): ${chapterPath}`);

		return { success: true, key: contentKey };
	}

	/**
	 * 按需提取书籍内部资源 (如图片)
	 */
	async processResource(userId: string, bookId: string, internalPath: string) {
		console.log(`[Worker] Processing resource: book=${bookId}, path=${internalPath}`);

		// 1. 获取 rootDir
		const book = await this.env.LEAF_BOOK_DB.prepare(
			"SELECT root_dir FROM books WHERE id = ?"
		).bind(bookId).first<{ root_dir: string }>();
		const rootDir = book?.root_dir || "";

		// 2. 加载 EPUB
		const epubKey = `books/${userId}/${bookId}/original.epub`;
		const epubObject = await this.env.LEAF_BOOK_BUCKET.get(epubKey);
		if (!epubObject) throw new Error(`[Worker] EPUB not found: ${epubKey}`);

		const epubBuffer = await epubObject.arrayBuffer();
		const fullPath = rootDir + decodeURIComponent(internalPath);

		// 3. 提取文件
		const unzipped = fflate.unzipSync(new Uint8Array(epubBuffer), {
			filter: (file) => file.name === fullPath
		});

		const fileData = unzipped[fullPath];
		if (!fileData) {
			console.error(`[Worker] Resource not found in zip: ${fullPath}`);
			return null;
		}

		// 返回 Uint8Array，RPC 会处理传输
		return fileData;
	}

	async processArticle(userId: string, articleId: string) {
		console.log(`[Worker] Received article process request: user=${userId}, articleId=${articleId}`);

		// 1. 从 D1 获取文章记录
		const article = await this.env.LEAF_BOOK_DB.prepare(
			"SELECT * FROM articles WHERE id = ? AND user_id = ?"
		).bind(articleId, userId).first();

		if (!article) {
			throw new Error(`[Worker] Article ${articleId} not found in D1 for user ${userId}`);
		}

		console.log(`[Worker] Starting crawl for: ${article.source_url}`);

		try {
			// 2. 调用重构后的爬虫工具函数
			const parsedArticle = await crawlArticle(article.source_url as string);

			if ((this.env as any).NODE_ENV === 'development') {
				console.log("[Worker] Parsed Article JSON:", JSON.stringify(parsedArticle, null, 2));
			}

			console.log(`[Worker] Successfully extracted article: ${parsedArticle.title}`);

			// 3. 将正文 HTML 持久化到 R2
			const contentKey = `articles/${userId}/${articleId}/content.html`;
			await this.env.LEAF_BOOK_BUCKET.put(contentKey, parsedArticle.content, {
				httpMetadata: { contentType: "text/html;charset=UTF-8" },
			});
			console.log(`[Worker] Successfully saved article content to R2: ${contentKey}`);

			// 4. 更新 D1 状态为 ready (初始摘要设为 null，待手动触发)
			await this.env.LEAF_BOOK_DB.prepare(
				"UPDATE articles SET title = ?, content = ?, summary = ?, source = ?, status = 'ready' WHERE id = ?"
			).bind(
				parsedArticle.title || article.title,
				contentKey,
				null,
				parsedArticle.source,
				articleId
			).run();

			console.log(`[Worker] Article ${articleId} processed and metadata updated in D1`);

			return {
				title: parsedArticle.title,
				contentLength: parsedArticle.content.length
			};

		} catch (e: any) {
			console.error(`[Worker] Error processing article ${articleId}: ${e.message}`);

			// 更新 D1 状态为 error
			await this.env.LEAF_BOOK_DB.prepare(
				"UPDATE articles SET status = 'error' WHERE id = ?"
			).bind(articleId).run();

			throw e;
		}
	}

	/**
	 * 专门用于重新生成摘要
	 * 优点：直接读取 R2 中已有的正文，不重新执行解压或爬取
	 */
	async processSummary(userId: string, type: 'article' | 'book', id: string, path?: string) {
		console.log(`[Worker] Manually re-processing summary: type=${type}, id=${id}, path=${path}`);

		let contentKey = "";
		let title = "";

		if (type === 'book') {
			if (!path) throw new Error("Path is required for book summary");
			contentKey = `books/${userId}/${id}/content/${path}`;
			title = path; // 书籍路径作为临时标题上下文
		} else {
			contentKey = `articles/${userId}/${id}/content.html`;
			// 尝试从 D1 获取标题作为上下文
			const article = await this.env.LEAF_BOOK_DB.prepare(
				"SELECT title FROM articles WHERE id = ?"
			).bind(id).first<{ title: string }>();
			title = article?.title || "Article";
		}

		// 1. 从 R2 读取已存在的清洗后的内容
		const object = await this.env.LEAF_BOOK_BUCKET.get(contentKey);
		if (!object) throw new Error(`Processed content not found in R2: ${contentKey}`);
		const content = await object.text();

		// 2. 重新运行 AI 摘要
		const summaryJson = await this._runAISummary(title, content);
		const resultSummary = summaryJson ? JSON.parse(summaryJson) : { summaries: [] };

		// 3. 持久化结果
		if (type === 'book') {
			const summaryKey = `${contentKey}.summary.json`;
			await this.env.LEAF_BOOK_BUCKET.put(summaryKey, summaryJson || JSON.stringify({ summaries: [] }), {
				httpMetadata: { contentType: 'application/json; charset=utf-8' }
			});
		} else {
			await this.env.LEAF_BOOK_DB.prepare(
				"UPDATE articles SET summary = ? WHERE id = ?"
			).bind(summaryJson, id).run();
		}

		return { success: true, summary: resultSummary };
	}

	/**
	 * 图片 OCR 文字提取 (PRD-015)
	 * 支持书籍内部资源 (R2) 和文章外部资源 (URL)
	 */
	async processOCR(userId: string, params: { bookId?: string, path?: string, url?: string }) {
		console.log(`[Worker] Starting Gemini OCR task:`, params);
		
		let uint8Array: Uint8Array;

		try {
			if (params.bookId && params.path) {
				const contentKey = `books/${userId}/${params.bookId}/content/${params.path}`;
				const object = await this.env.LEAF_BOOK_BUCKET.get(contentKey);
				if (!object) throw new Error(`Image not found in storage: ${params.path}`);
				uint8Array = new Uint8Array(await object.arrayBuffer());
			} else if (params.url) {
				const res = await fetch(params.url, {
					headers: { "User-Agent": "LeafReader-OCR/1.0" },
					signal: AbortSignal.timeout(10000)
				});
				if (!res.ok) throw new Error(`Failed to fetch remote image: ${res.statusText}`);
				uint8Array = new Uint8Array(await res.arrayBuffer());
			} else {
				throw new Error("Missing identification parameters (bookId/path or url)");
			}

			// 将图片转换为 Base64
			const base64Image = btoa(
				uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '')
			);

			// 整理可用 Gemini API Keys
			const geminiKeys = [
				this.env.GEMINI_API_KEY,
				this.env.GEMINI_API_KEY_B,
				this.env.GEMINI_API_KEY_C,
				this.env.GEMINI_API_KEY_D
			].filter(Boolean) as string[];

			if (geminiKeys.length === 0) throw new Error("No Gemini API keys configured");

			// 循环尝试 API 节点
			for (let i = 0; i < geminiKeys.length; i++) {
				const apiKey = geminiKeys[i];
				try {
					const model = "gemini-2.5-flash";
					const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

					const res = await fetch(url, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							contents: [{
								parts: [
									{ text: "请准确地提取并转录这张图片中的所有文字。请将文字合并为自然的段落，忽略由于图片物理布局导致的错误换行。保持原始的语义结构。仅返回纯净、格式化后的文本内容。如果没有检测到文字，请返回“(未检测到文字)”。" },
									{
										inline_data: {
											mime_type: "image/jpeg",
											data: base64Image
										}
									}
								]
							}],
							generationConfig: {
								temperature: 0.1,
								max_output_tokens: 2048,
							}
						})
					});

					if (!res.ok) {
						const errText = await res.text();
						throw new Error(`Gemini API error: ${res.status} ${errText}`);
					}

					const data: any = await res.json();
					const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

					if (text) {
						console.log(`[Worker] OCR success with Key #${i + 1}`);
						return { description: text.trim() }; // 对齐之前的返回结构
					}
				} catch (e: any) {
					console.warn(`[Worker] Gemini Key #${i + 1} failed: ${e.message}`);
					if (i === geminiKeys.length - 1) throw e;
				}
			}
		} catch (e: any) {
			console.error(`[Worker] OCR Engine failed: ${e.message}`);
			throw new Error(`OCR processing failed: ${e.message}`);
		}
	}

	/**
	 * 统一的 AI 摘要执行逻辑
	 */
	private async _runAISummary(title: string, content: string): Promise<string | null> {
		const isDev = (this.env as any).NODE_ENV === 'development';

		// 开发环境下强行跳过 AI，返回 Mock 数据以填充哨兵文件
		if (isDev) {
			console.log(`[Worker] Skipping AI summary for ${title} in dev mode.`);
			return JSON.stringify({
				summaries: [],
				source: 'mock-dev'
			});
		}

		try {
			console.log(`[Worker] Starting AI summary calculation for: ${title}`);
			const compactText = toCompactText(content);

			const summaryResult = await generateSummary(
				this.env.AI,
				compactText,
				this.env.GEMINI_API_KEY,
				[
					this.env.GEMINI_API_KEY_B,
					this.env.GEMINI_API_KEY_C,
					this.env.GEMINI_API_KEY_D
				]
			);

			if (summaryResult) {
				console.log(`[Worker] Successfully generated AI summary for ${title} (${summaryResult.summaries?.length || 0} items)`);
				return JSON.stringify(summaryResult);
			}
		} catch (e) {
			console.error(`[Worker] AI Summary generation failed for ${title}:`, e);
		}

		return null;
	}

}
