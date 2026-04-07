import { NextResponse } from 'next/server';
import { createHandler, HandlerContext } from '../../_handler';

/**
 * 通用 R2 资源代理获取
 * 直接从查询参数获取 key，并根据当前用户 ID 进行前缀鉴权，避免再次查询数据库
 */
export const GET = createHandler(async ({ env, user }: HandlerContext, request: Request) => {
	const { searchParams } = new URL(request.url);
	const key = searchParams.get('key');
	const userId = user.sub;

	if (!key) {
		return new NextResponse('Missing key', { status: 400 });
	}

	// 安全校验：由于 key 为 books/{userId}/{bookId}/...
	// 我们必须确保请求的 key 是属于当前登录用户的
	if (!key.startsWith(`books/${userId}/`)) {
		return new NextResponse('Unauthorized: Access to this resource is forbidden', { status: 403 });
	}

	// 1. 直接从 R2 获取对象
	const object = await env.LEAF_BOOK_BUCKET.get(key);
	if (!object) {
		return new NextResponse('Resource missing in bucket', { status: 404 });
	}

	// 2. 构建响应
	const headers = new Headers();
	setMetadata(object, headers);

	headers.set('etag', object.httpEtag);
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');

	return new Response(object.body, {
		headers,
	});
});

/**
 * 辅助函数：根据环境设置响应元数据
 * 解决本地代理模式下 Headers 实例不可序列化导致的 RPC 报错
 */
function setMetadata(object: R2ObjectBody, headers: Headers) {
	if (process.env.NODE_ENV === 'development') {
		// 兼容性修正：在本地开发环境（代理模式）下，直接传递 Headers 实例给代理方法会触发序列化报错。
		// 这里改为直接从 POJO 类型的 httpMetadata 中读取关键元数据。
		if (object.httpMetadata?.contentType) {
			headers.set('Content-Type', object.httpMetadata.contentType);
		}
		if (object.httpMetadata?.contentEncoding) {
			headers.set('Content-Encoding', object.httpMetadata.contentEncoding);
		}
		if (object.httpMetadata?.contentLanguage) {
			headers.set('Content-Language', object.httpMetadata.contentLanguage);
		}
		if (object.httpMetadata?.contentDisposition) {
			headers.set('Content-Disposition', object.httpMetadata.contentDisposition);
		}
	} else {
		// 线上环境正常执行官方推荐方法
		object.writeHttpMetadata(headers);
	}
}
