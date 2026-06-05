import { NextResponse } from 'next/server';
import { createHandler } from '../../_handler';

// 远程图片代理成功后，允许浏览器/CDN 缓存一周，减少重复请求原站图片。
const IMAGE_CACHE_MAX_AGE = 60 * 60 * 24 * 7;

// 这些 hostname 指向本机或内网地址，不能让代理去访问，避免 SSRF 风险。
const PRIVATE_HOST_PATTERNS = [
	/^localhost$/i,
	/\.localhost$/i,
	/^127\./,
	/^0\./,
	/^10\./,
	/^192\.168\./,
	/^169\.254\./,
	/^172\.(1[6-9]|2\d|3[0-1])\./,
	/^\[?::1\]?$/,
];

const isBlockedHost = (hostname: string) =>
	PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));

const getRefererForImage = (url: URL) => {
	// 豆瓣图片经常会校验 Referer；这里模拟来自豆瓣页面的图片请求。
	if (url.hostname.endsWith('doubanio.com')) {
		return 'https://www.douban.com/';
	}

	// 其它站点先使用图片所在站点的根地址，作为一个通用、温和的默认 Referer。
	return `${url.protocol}//${url.hostname}/`;
};

/**
 * 获取文章远程图片资源代理接口
 * GET /api/articles/resource?url=[remoteImageUrl]
 */
export const GET = createHandler(async (_context, request: Request) => {
	const requestUrl = new URL(request.url);
	const rawUrl = requestUrl.searchParams.get('url');

	// 代理接口必须带原始图片 URL，例如 /api/articles/resource?url=https%3A...
	if (!rawUrl) {
		return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
	}

	// 先把传入字符串解析成 URL 对象，非法 URL 直接拒绝。
	let imageUrl: URL;
	try {
		imageUrl = new URL(rawUrl);
	} catch {
		return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
	}

	// 只代理公开的 http/https 图片地址，避免访问 file://、内网地址等危险目标。
	if (!['http:', 'https:'].includes(imageUrl.protocol) || isBlockedHost(imageUrl.hostname)) {
		return NextResponse.json({ error: 'Unsupported image url' }, { status: 400 });
	}

	// 由服务端代替浏览器请求远程图片，绕过一部分基于浏览器 Referer 的图片防盗链。
	const response = await fetch(imageUrl, {
		headers: {
			'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
			'Referer': getRefererForImage(imageUrl),
			'User-Agent': 'Mozilla/5.0 (compatible; LeafReader/1.0)',
		},
		signal: AbortSignal.timeout(10000),
	});

	// 原站请求失败时，把失败状态传给前端，方便 DevTools 里直接看到远程图片不可用。
	if (!response.ok || !response.body) {
		return NextResponse.json(
			{ error: 'Remote image unavailable' },
			{ status: response.status || 502 }
		);
	}

	// 只允许真正的图片响应通过，避免这个接口变成任意文件/网页代理。
	const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
	if (!contentType.toLowerCase().startsWith('image/')) {
		return NextResponse.json({ error: 'Remote resource is not an image' }, { status: 415 });
	}

	// 把远程图片流原样转发给浏览器，并设置缓存。
	const headers = new Headers();
	headers.set('Content-Type', contentType);
	headers.set('Cache-Control', `public, max-age=${IMAGE_CACHE_MAX_AGE}`);

	return new Response(response.body, { headers });
});
