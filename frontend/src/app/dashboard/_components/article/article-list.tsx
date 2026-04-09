import { Article } from './article';
import { UploadArticle } from './upload-article';

const DUMMY_ARTICLES: { id: number; title: string; source: string; url: string; status?: 'ready' | 'processing' | 'error' }[] = [
	{ id: 1, title: '如何构建高性能的 AI Web 应用', source: '机器之心', url: '#', status: 'processing' },
	{ id: 2, title: 'Next.js 15 原生异步路由深度解析', source: 'Vercel Blog', url: '#' },
	{ id: 3, title: '从零开始集成 Cloudflare Workers 与 D1 数据库', source: 'Medium', url: '#' },
	{ id: 4, title: '2024年 AI 阅读工具大汇总：从采集到沉淀', source: '知乎专栏', url: '#' },
	{ id: 5, title: '大模型时代的浏览器采集技术方案探究', source: '开发者社区', url: '#' },
	{ id: 6, title: '理解 React Server Components 的流式渲染模型', source: 'React Dev', url: '#', status: 'processing' },
	{ id: 7, title: 'Tailwind CSS v4 带来的性能革命与新特性', source: 'Tailwind News', url: '#' },
	{ id: 8, title: 'WeChat 文章采集的防爬虫机制与破解思路', source: '安全实验室', url: '#', status: 'error' },
	{ id: 9, title: '如何利用 TypeScript 装饰器优化前端鉴权逻辑', source: 'Dev.to', url: '#' },
	{ id: 10, title: '深度学习入门：从感知机到 Transformer', source: '知乎', url: '#' },
	{ id: 11, title: '边缘计算：Cloudflare Workers 的应用实践', source: 'Cloudflare Docs', url: '#' },
	{ id: 12, title: '2025年 Web 开发趋势预测：端智能的兴起', source: 'TechCrunch', url: '#' },
	{ id: 13, title: '使用 Rust 构建高性能 WebAssembly 模块', source: 'Mozilla Blog', url: '#' },
	{ id: 14, title: '打造沉浸式阅读体验：排版艺术与 CSS 设计', source: 'CSS-Tricks', url: '#' },
	{ id: 15, title: '提示词工程最佳实践：如何让 AI 更懂你的意图', source: 'OpenAI Blog', url: '#' },
	{ id: 16, title: '数据库原子性与分布式事务深度剖析', source: 'Data Engineering', url: '#' },
	{ id: 17, title: '微前端架构在大型 SaaS 系统中的应用', source: 'InfoQ', url: '#' },
	{ id: 18, title: '前端性能优化之道：指标监控与瓶颈定位', source: 'Google Chrome Blog', url: '#' },
	{ id: 19, title: '开源项目的商业化路径：从社区到独角兽', source: 'GitHub Story', url: '#' },
	{ id: 20, title: '从用户体验角度谈设计系统的组件拆分', source: 'Smashing Magazine', url: '#' },
];

/**
 * ArticleList (文章列表)
 * 职责：以垂直列表形式展示采集的文章。
 */
export function ArticleList() {
	return (
		<main className="w-full flex-1">
			{/* 模拟地址栏 - 吸顶 */}
			<div className="sticky top-[65px] z-40 bg-base-200/95 backdrop-blur-sm px-4 md:px-6 py-4 border-b border-base-300 mb-1">
				<div className="max-w-6xl mx-auto">
					<UploadArticle />
				</div>
			</div>

			<div className="flex flex-col gap-3 p-4 pt-0 md:px-6 md:pb-6 md:pt-0">
				{DUMMY_ARTICLES.map((article) => (
					<Article key={article.id} article={article} />
				))}
			</div>
		</main>
	);
}
