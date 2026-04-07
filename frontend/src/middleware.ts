import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyLogtoIdToken } from './lib/auth';

/**
 * Next.js 16 Proxy (原 Middleware)
 * 处理 Logto Protected App 的认证拦截与路由控制
 */
export const runtime = 'experimental-edge';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. 如果是根路径，重定向到 /dashboard
  if (pathname === '/') {
    const url = new URL('/dashboard', request.url);
    return NextResponse.redirect(url);
  }

  // 1. 获取 Logto 注入的身份凭证 (来自网关)
  const idToken = request.headers.get('Logto-ID-Token');
  const isDev = process.env.NODE_ENV === 'development';

  // 2. 权限校验与 JWT 签名校验 (防伪造)
  if (!idToken) {
    // 本地开发模式下允许跳过验证
    if (isDev) {
      return NextResponse.next();
    }
    // 未携带 ID Token, 引导强制登录
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // 对 Token 进行真实的签名与 Issuer 校验 (Zero Trust)
  const user = await verifyLogtoIdToken(idToken);
  if (!user) {
    // ID Token 校验失败 (可能伪造或失效), 强制执行退出并重新登录
    // 这里跳转到 sign-out，Logto 后端会清除 Session 并自动带去重新登录
    return NextResponse.redirect(new URL('/sign-out', request.url));
  }

  return NextResponse.next();
}

/**
 * 配置拦截规则
 */
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了:
     * 1. /_next/* (Next.js 内部资源)
     * 2. /static/*, /favicon.ico 等 (静态资源)
     * 3. /sign-in 和 /sign-out (权限相关特殊路径，避免重定向循环)
     */
    '/((?!_next/static|_next/image|favicon.ico|sign-in|sign-out).*)',
  ],
};
