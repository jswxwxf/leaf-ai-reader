/**
 * request 是对 fetch 的透明封装
 * 仅添加了：判断 response.ok、解析 JSON 和统一的错误 alert
 */
export async function request<T>(
	input: RequestInfo | URL, 
	init?: RequestInit,
	options: { silent?: boolean } = {}
): Promise<T> {
	try {
		const response = await fetch(input, init);
		
		// 尝试解析 JSON 内容
		let data: any;
		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			data = await response.json();
		} else {
			data = await response.text();
		}

		if (!response.ok) {
			const errorMessage = data?.error || data?.message || `请求失败 (${response.status})`;
			throw new Error(errorMessage);
		}

		// 业务逻辑检查：如果接口返回了 success 字段且为 false，视为失败
		if (data && typeof data === 'object' && 'success' in data && data.success === false) {
			const errorMessage = data.error || data.message || '操作失败';
			throw new Error(errorMessage);
		}

		return data as T;
	} catch (error) {
		console.error(`[Request Error] ${input}:`, error);
		
		const message = error instanceof Error ? error.message : '发生了未知错误';
		const isNetworkError = error instanceof TypeError && 
			(message.includes('fetch') || message.includes('NetworkError'));
		const isAbortError = error instanceof Error && error.name === 'AbortError';

		// 仅在非静默模式下弹出 alert
		// 排除掉 AbortError (请求中止) 和网络请求基础错误 (Failed to fetch)
		if (!options.silent && !isAbortError && !isNetworkError) {
			alert(message);
		}
		
		// 将错误重新抛出，让调用方配合 finally 自动处理
		throw error;
	}
}
