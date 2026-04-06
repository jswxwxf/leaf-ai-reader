import { createRemoteJWKSet, jwtVerify } from 'jose';

// Logto 配置信息
const LOGTO_ISSUER = 'https://vxc0ju.logto.app/oidc';
const LOGTO_JWKS_URL = `${LOGTO_ISSUER}/jwks`;
const LOGTO_AUDIENCE = '44ct58hammmq9keagsc0j';

// 登出跳转地址 (Protected App 模式下使用预设的 /sign-out 路由)
export const LOGTO_LOGOUT_URL = '/sign-out';

// 创建 JWK 集合 (兼容 Edge 运行时的单例)
const JWKS = createRemoteJWKSet(new URL(LOGTO_JWKS_URL));

export interface LogtoUser {
  sub: string;
  name?: string;
  email?: string;
}

/**
 * 校验 ID Token 的真伪 (签名、Issuer 和 Audience)
 * 该函数可被 Middleware 和 Server Component 安全调用
 */
export async function verifyLogtoIdToken(idToken: string) {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: LOGTO_ISSUER,
      audience: LOGTO_AUDIENCE,
    });
    return payload as unknown as LogtoUser;
  } catch (e) {
    console.error('JWT Verification failed:', e);
    return null;
  }
}

/**
 * 在服务端获取当前用户。
 * 注意：该函数内使用了 next/headers，因此只能在 Page/Server Component 中调用
 */
export async function getCurrentUser(): Promise<LogtoUser | null> {
  // 必须动态导入以防止 Middleware 编译失败
  const { headers } = await import('next/headers');
  const headersList = await headers();
  const idToken = headersList.get('Logto-ID-Token');

  if (!idToken) {
    if (process.env.NODE_ENV === 'development') {
      return { sub: 'local-dev', name: '本地开发用户' };
    }
    return null;
  }

  return await verifyLogtoIdToken(idToken);
}
