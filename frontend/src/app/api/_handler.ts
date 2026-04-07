import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser, LogtoUser } from '@/lib/auth';

/**
 * 业务逻辑处理函数的上下文定义
 */
export interface HandlerContext {
	env: CloudflareEnv;
	ctx: ExecutionContext;
	user: LogtoUser;
}

/**
 * 业务逻辑处理函数的类型定义
 * 可以返回普通的 JSON 对象，也可以返回标准的 NextResponse
 */
export type HandlerLogic<T = any> = (
	context: HandlerContext,
	request: Request
) => Promise<T | NextResponse>;

/**
 * 统一的 API Route Handler 包装函数
 * 负责：鉴权、环境获取、错误捕获、标准化响应
 */
export function createHandler<T>(logic: HandlerLogic<T>) {
	return async function (request: Request) {
		try {
			// 1. 获取当前用户并校验鉴权
			const user = await getCurrentUser();
			if (!user?.sub) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}

			// 2. 获取 Cloudflare 运行环境信息
			const cloudflare = getCloudflareContext();

			// 3. 执行核心业务逻辑
			const result = await logic({
				user,
				env: cloudflare.env as CloudflareEnv,
				ctx: cloudflare.ctx,
			}, request);

			// 4. 根据业务层返回结果封装响应
			if (result instanceof NextResponse) {
				return result;
			}
			return NextResponse.json(result);

		} catch (error) {
			// 5. 统一错误处理
			console.error("[Route API Error]", error);

			// 在开发环境下返回更详细的错误信息
			const isDev = process.env.NODE_ENV === 'development';
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			
			return NextResponse.json(
				{ 
					error: 'Internal Server Error',
					...(isDev ? { details: errorMessage } : {})
				},
				{ status: 500 }
			);
		}
	};
}
