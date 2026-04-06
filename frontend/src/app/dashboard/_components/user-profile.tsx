import { LogOut } from 'lucide-react';
import { getCurrentUser, LOGTO_LOGOUT_URL } from '@/lib/auth';

export async function UserProfile() {
	const user = await getCurrentUser();
	const displayName = user?.name ?? user?.email ?? user?.sub ?? '未知用户';

	return (
		<div className="flex-none gap-4 flex items-center">
			<span className="text-sm font-medium opacity-70 hidden sm:inline-block">
				{displayName}
			</span>
			<a 
				href={LOGTO_LOGOUT_URL}
				className="btn btn-ghost btn-sm text-error"
			>
				<LogOut className="w-4 h-4" />
				Logout
			</a>
		</div>
	);
}
