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
import { EpubParser } from "./utils/epub";

export default class extends WorkerEntrypoint<Env> {
	/**
	 * 处理 HTTP 请求，防止部署报错并支持基础的状态验证。
	 */
	async fetch(request: Request): Promise<Response> {
		// const url = new URL(request.url);
		// if (url.pathname === "/debug") {
		// 	const userId = "local-dev";
		// 	const bookId = "8c1988bc-9c76-4034-aded-1eeb7aa1e75e";
		// 	try {
		// 		const result = await this.processBook(userId, bookId);
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
}
