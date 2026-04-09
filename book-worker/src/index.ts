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

export default class extends WorkerEntrypoint<Env> {
	/**
	 * 处理 HTTP 请求，防止部署报错并支持基础的状态验证。
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/debug") {
			const userId = "local-dev";
			const articleId = "df97fd0b-ae47-4441-b02d-0c891e2f625f";
			try {
				const result = await this.processArticle(userId, articleId);
				return Response.json(result);
			} catch (e: any) {
				return new Response(e.message, { status: 500 });
			}
		}

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

		// 4.1 上传目录 (TOC) 到 R2 并获取总章节数
		const totalCount = this.countChapters(metadata.chapters);
		const tocR2Key = `books/${userId}/${bookId}/toc.json`;
		await this.env.LEAF_BOOK_BUCKET.put(tocR2Key, JSON.stringify(metadata.chapters), {
			httpMetadata: { contentType: "application/json" },
		});
		console.log(`[Indexer] Successfully uploaded toc.json to ${tocR2Key}, total chapters: ${totalCount}`);

		// 4.2 更新书籍元数据
		try {
			await this.env.LEAF_BOOK_DB.prepare(
				`UPDATE books 
				 SET title = ?, 
				     author = ?, 
					 published_at = ?,
					 total_chapters = ?, 
					 cover_r2_key = ?, 
					 status = 'ready' 
				 WHERE id = ? AND user_id = ?`
			).bind(
				metadata.title,
				metadata.author,
				metadata.publishDate,
				totalCount,
				updatedCoverKey,
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
				chaptersCount: totalCount,
				coverR2Key: updatedCoverKey,
			}
		};
	}

	/**
	 * 统计所有嵌套章节的总数
	 */
	private countChapters(chapters: any[]): number {
		let count = 0;
		const traverse = (items: any[]) => {
			for (const item of items) {
				count++;
				if (item.children && item.children.length > 0) {
					traverse(item.children);
				}
			}
		};
		traverse(chapters);
		return count;
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

			// 3. 更新 D1 状态为 ready
			await this.env.LEAF_BOOK_DB.prepare(
				"UPDATE articles SET title = ?, content = ?, source = ?, status = 'ready' WHERE id = ?"
			).bind(
				parsedArticle.title || article.title,
				parsedArticle.content,
				parsedArticle.source,
				articleId
			).run();

			console.log(`[Worker] Article ${articleId} processed and updated in D1`);

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
}
