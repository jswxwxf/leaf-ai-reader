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
		// 	const userId = "jlypxopvhn7o";
		// 	const bookId = "a342efab-00e4-458e-8657-6b74e107c575";
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
		const coverR2Key = `books/${userId}/${bookId}/cover.jpg`;

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
		if (metadata.coverPath) {
			const coverBuffer = await parser.getFile(metadata.coverPath, "uint8array");
			if (coverBuffer) {
				await this.env.LEAF_BOOK_BUCKET.put(coverR2Key, coverBuffer, {
					httpMetadata: { contentType: "image/jpeg" },
				});
				console.log(`[Indexer] Extracted and saved cover to ${coverR2Key}`);
			}
		}

		console.log(`[Indexer] Successfully parsed book: ${metadata.title}`);

		// 4. 更新数据库状态
		// 在元数据解析和封面提取之后，执行 D1 更新
		const updatedCoverKey = metadata.coverPath ? coverR2Key : null;

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
				metadata.chapters.length,
				updatedCoverKey,
				bookId,
				userId
			).run();

			console.log(`[Indexer] Successfully updated database for book ${bookId}`);
		} catch (e: any) {
			console.error(`[Indexer] Failed to update database for book ${bookId}: ${e.message}`);
			throw new Error(`Database update failed: ${e.message}`);
		}

		return {
			success: true,
			body: {
				title: metadata.title,
				author: metadata.author,
				publishedAt: metadata.publishDate,
				chaptersCount: metadata.chapters.length,
				coverR2Key: updatedCoverKey,
			}
		};
	}
}
