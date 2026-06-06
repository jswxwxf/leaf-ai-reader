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
import {
	processSummary as processSummaryService,
	updateSummary as updateSummaryService,
} from './services/summary-service';
import { processOCR as processOCRService } from './services/ocr-service';
import { processArticle as processArticleService } from './services/article-service';
import {
	processBook as processBookService,
	processChapter as processChapterService,
	processResource as processResourceService,
} from './services/book-service';
import { type AISummary } from './utils/summary';

export default class BookWorker extends WorkerEntrypoint<Env> {
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
	 * 处理 EPUB 元数据、封面和目录索引。
	 */
	processBook(userId: string, bookId: string) {
		return processBookService(this.env, userId, bookId);
	}

	/**
	 * 解析并缓存指定章节正文。
	 */
	processChapter(userId: string, bookId: string, chapterPath: string) {
		return processChapterService(this.env, userId, bookId, chapterPath);
	}

	/**
	 * 按需提取书籍内部资源，如图片。
	 */
	processResource(userId: string, bookId: string, internalPath: string) {
		return processResourceService(this.env, userId, bookId, internalPath);
	}

	/**
	 * 抓取或数字化文章正文并写入存储。
	 */
	processArticle(userId: string, articleId: string) {
		return processArticleService(this.env, userId, articleId);
	}

	/**
	 * 重新生成摘要，直接复用已缓存正文。
	 */
	processSummary(userId: string, type: 'article' | 'book', id: string, path?: string) {
		return processSummaryService(this.env, userId, type, id, path);
	}

	/**
	 * 全量覆盖保存摘要，用于用户删除、新增或修改后的持久化。
	 */
	updateSummary(userId: string, type: 'article' | 'book', id: string, summaries: AISummary[], path?: string) {
		return updateSummaryService(this.env, userId, type, id, summaries, path);
	}

	/**
	 * 图片 OCR 文字提取，支持书籍内部资源和外部 URL。
	 */
	processOCR(userId: string, params: { bookId?: string, path?: string, url?: string }) {
		return processOCRService(this.env, userId, params);
	}

}
