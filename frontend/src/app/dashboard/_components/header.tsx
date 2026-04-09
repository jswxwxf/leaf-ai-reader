import { BookOpen } from 'lucide-react';
import { UserProfile } from './user-profile';
import { ViewSwitcher } from './view-switcher';

/**
 * 顶部导航栏组件 (Header)
 * 职责：展示 Logo (Leaf AI Reader) 和视图切换、用户个人资料区域。
 * 注意：这是一个服务端组件，内部包含异步的 UserProfile。
 */
export function Header() {
	return (
		<header className="navbar bg-base-100 shadow-sm px-4 md:px-8 flex items-center gap-2 sticky top-0 z-20">
			<div className="flex-1">
				<a className="text-xl font-bold flex items-center gap-2 shrink-0">
					<BookOpen className="w-6 h-6 text-primary" />
					<span className="text-base sm:text-xl font-bold truncate">Leaf AI Reader</span>
				</a>
			</div>

			<div className="flex-none flex items-center gap-2 md:gap-6">
				{/* 视图切换按钮 (客户端交互) */}
				<ViewSwitcher />
				
				{/* 用户资料 (服务端异步渲染) */}
				<UserProfile />
			</div>
		</header>
	);
}
