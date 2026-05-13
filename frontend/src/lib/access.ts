const DEMO_USER_SUBS = new Set([
	'vzqf2no2raqt',
]);

export const DEMO_ACCESS_MESSAGE = 'Demo 账号仅开放一本图书的阅读与朗读体验。';

export type UserAccess = {
	isDemoUser: boolean;
	maxBooks: number | null;
	canUploadBook: boolean;
	canDeleteBook: boolean;
	canUseArticles: boolean;
	canUseSummary: boolean;
	canUseOcr: boolean;
};

const DEMO_ACCESS = {
	maxBooks: 1,
	canUploadBook: true,
	canDeleteBook: true,
	canUseArticles: false,
	canUseSummary: false,
	canUseOcr: false,
} satisfies Omit<UserAccess, 'isDemoUser'>;

type AccessUser = {
	sub?: string | null;
};

export type AccessGuardResult = {
	success: false;
	code: string;
	error: string;
	status: number;
};

export function getUserAccess(user: AccessUser | null | undefined): UserAccess {
	const isDemoUser = !!user?.sub && DEMO_USER_SUBS.has(user.sub);

	if (isDemoUser) {
		return {
			isDemoUser,
			...DEMO_ACCESS,
		};
	}

	return {
		isDemoUser,
		maxBooks: null,
		canUploadBook: true,
		canDeleteBook: true,
		canUseArticles: true,
		canUseSummary: true,
		canUseOcr: true,
	};
}

export async function checkBookUploadAccess({
	access,
	env,
	userId,
}: {
	access: UserAccess;
	env: CloudflareEnv;
	userId: string;
}): Promise<AccessGuardResult | null> {
	if (!access.canUploadBook) {
		return {
			success: false,
			code: 'DEMO_FEATURE_DISABLED',
			error: DEMO_ACCESS_MESSAGE,
			status: 403,
		};
	}

	if (access.maxBooks === null) {
		return null;
	}

	const row = await env.LEAF_BOOK_DB.prepare(
		"SELECT COUNT(*) AS count FROM books WHERE user_id = ?"
	).bind(userId).first<{ count: number }>();

	if (Number(row?.count ?? 0) < access.maxBooks) {
		return null;
	}

	return {
		success: false,
		code: 'DEMO_BOOK_LIMIT_REACHED',
		error: DEMO_ACCESS_MESSAGE,
		status: 403,
	};
}
