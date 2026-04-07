'use client'

import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { request } from '@/lib/request';
import { useBooks } from '../_context/books-context';

interface Props {
	variant?: 'hero' | 'compact';
}

interface UploadResponse {
	success: boolean;
	bookId: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 上传图书卡片组件
 */
export function UploadBook({ variant = 'compact' }: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const { refreshBooks } = useBooks();

	const handleClick = () => {
		if (isUploading) return;
		fileInputRef.current?.click();
	};

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// 基础校验
		if (!file.name.toLowerCase().endsWith('.epub')) {
			alert('请选择以 .epub 结尾的图书文件');
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			alert('文件大小不能超过 50MB');
			return;
		}

		console.log('准备开始上传文件:', file.name, file.size);
		setIsUploading(true);

		try {
			const formData = new FormData();
			formData.append('file', file);

			// 使用全局请求工具。如果失败，它会通过抛错自动跳到 finally，不再往下运行。
			const response = await request<UploadResponse>('/api/books/upload', {
				method: 'POST',
				body: formData,
			});

			// 只要运行到这里，说明请求一定是成功的
			alert(`已成功创建上传任务！书籍 ID: ${response.bookId}\n系统正在后台完成上传并解析内容，请稍后在列表中查看。`);
			
			// 触发 Dashboard 刷新逻辑
			refreshBooks();
		} finally {
			// 无论请求是否成功，甚至是代码内部运行报错，都确保状态重置
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	if (variant === 'hero') {
		return (
			<div 
				onClick={handleClick}
				className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group"
			>
				<input 
					type="file" 
					ref={fileInputRef}
					onChange={handleFileChange}
					accept=".epub"
					className="hidden" 
				/>
				<div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
					<Plus className="w-8 h-8 text-blue-600" />
				</div>
				<h3 className="text-xl font-semibold mb-2">上传你的第一本书</h3>
				<p className="text-gray-500">支持 EPUB 格式，最大 50MB</p>
				{isUploading && <p className="mt-4 text-blue-500 animate-pulse">正在处理上传中...</p>}
			</div>
		);
	}

	return (
		<div 
			onClick={handleClick}
			className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4 group"
		>
			<input 
				type="file" 
				ref={fileInputRef}
				onChange={handleFileChange}
				accept=".epub"
				className="hidden" 
			/>
			<div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
				<Plus className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
			</div>
			<div>
				<h3 className="font-medium">添加图书</h3>
				<p className="text-sm text-gray-500">
					{isUploading ? '正在上传请求...' : '点击上传 EPUB 文件'}
				</p>
			</div>
		</div>
	);
}
