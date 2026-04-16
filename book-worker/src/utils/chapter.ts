import { Chapter } from "../epub";

/**
 * 规范化章节列表，合并指向相同物理文件的冗余条目
 * 
 * 规则：
 * 1. 同级合并：在同一层级的列表中，如果连续多个条目指向同一个物理文件，只保留第一个
 * 2. 父子合并：如果一个节点的所有子节点（经过规则1处理后）都指向该节点相同的物理文件，则清空子节点
 */
export function normalizeChapters(chapters: Chapter[]): Chapter[] {
	// 0. 黑名单关键词（仅过滤重复的目录页）
	const BLACKLIST_REGEX = /目录|Contents|Table of Contents|TOC/i;

	// 1. 过滤黑名单并执行同级去重：保留物理文件切换的第一个入口
	const filtered = chapters
		.filter(ch => !BLACKLIST_REGEX.test(ch.title?.trim() || ""))
		.filter((ch, index, arr) => {
			if (index === 0) return true;
			// 比较当前项与前一项的路径
			return ch.path !== arr[index - 1].path;
		});

	// 2. 递归递归处理子节点，并应用父子合并逻辑
	return filtered.map((ch) => {
		if (ch.children && ch.children.length > 0) {
			// 先递归简化子节点
			const processedChildren = normalizeChapters(ch.children);
			
			// 检查是否所有剩余子节点都指向与父节点相同的路径
			const allChildrenMatchParent = processedChildren.length > 0 && 
				processedChildren.every(child => child.path === ch.path);

			if (allChildrenMatchParent) {
				// 如果所有子节点都和父亲一样，说明子级没有提供额外的新文件信息，直接清空
				return { ...ch, children: [] };
			} else {
				return { ...ch, children: processedChildren };
			}
		}
		return ch;
	});
}
