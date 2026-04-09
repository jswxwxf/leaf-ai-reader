import { StateStorage } from 'zustand/middleware';

/**
 * 创建一个将 Zustand 状态同步到 URL Search 参数的存储适配器
 * @param paramName URL 参数名 (例如 'view', 'page')
 */
export function createUrlSearchStorage(paramNames: string | string[]): StateStorage {
	const names = Array.isArray(paramNames) ? paramNames : [paramNames];

	return {
		getItem: (_name): string | null => {
			if (typeof window === 'undefined') return null;
			const searchParams = new URL(window.location.href).searchParams;
			const state: Record<string, any> = {};
			let hasValue = false;

			for (const key of names) {
				const value = searchParams.get(key);
				if (value !== null) {
					state[key] = value;
					hasValue = true;
				}
			}

			// 如果指定的参数在 URL 中都不存在，返回 null 触发默认 initialState
			return hasValue ? JSON.stringify({ state, version: 0 }) : null;
		},
		setItem: (_name, value): void => {
			const parsed = JSON.parse(value);
			const url = new URL(window.location.href);
			let isChanged = false;

			// 遍历所有需要同步到 URL 的字段名
			for (const key of names) {
				const newVal = parsed.state?.[key];
				// 仅处理有效的值 (忽略 undefined 或 null)
				if (newVal !== undefined && newVal !== null) {
					const stringVal = String(newVal);
					// 只有当状态值与当前 URL 中的参数值不一致时，才执行更新
					// 这样可以避免不必要的 DOM 操作和对 history 堆栈的频繁刷新
					if (url.searchParams.get(key) !== stringVal) {
						url.searchParams.set(key, stringVal);
						isChanged = true;
					}
				}
			}

			if (isChanged) {
				window.history.replaceState(null, '', url.toString());
			}
		},
		removeItem: (_name): void => {
			const url = new URL(window.location.href);
			for (const key of names) {
				url.searchParams.delete(key);
			}
			window.history.replaceState(null, '', url.toString());
		},
	};
}
