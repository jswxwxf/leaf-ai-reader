import { BookOpen } from 'lucide-react';
import { UserProfile } from './user-profile';

/**
 * 顶部导航栏组件 (Header)
 * 职责：展示 Logo (Leaf AI Reader) 和用户个人资料区域。
 * 这是一个服务端组件 (Server Component)，直接引用并渲染 UserProfile。
 */
export function Header() {
	return (
		<header className="navbar bg-base-100 shadow-sm px-4 md:px-8">
			<div className="flex-1">
				<a className="text-xl font-bold flex items-center gap-2">
					<BookOpen className="w-6 h-6 text-primary" />
					Leaf AI Reader
				</a>
			</div>
			<div className="flex-none gap-4">
				<UserProfile />
			</div>
		</header>
	);
}
