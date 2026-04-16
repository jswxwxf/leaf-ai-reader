import * as fflate from "fflate";
import { XMLParser } from "fast-xml-parser";

/**
 * EPUB 解析器：负责从 EPUB 文件中提取元数据、封面路径和章节列表
 * 使用 fflate 替换 JSZip，以获得更好的性能和更小的体积，满足 Cloudflare Workers 限制
 */
export interface Chapter {
	id?: string;
	title: string;
	path: string;
	level: number;
	children: Chapter[];
}

export class EpubParser {
	private data: Uint8Array | null = null;
	private parser: XMLParser;
	private decoder = new TextDecoder();

	constructor() {
		this.parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
		});
	}

	/**
	 * 加载 EPUB 文件内容
	 */
	async load(buffer: ArrayBuffer) {
		this.data = new Uint8Array(buffer);
	}

	/**
	 * 解析 EPUB 结构
	 */
	async parse() {
		if (!this.data) throw new Error("File data not loaded. Call load() first.");

		// 1. 寻找根文件 (OPF) 路径
		const containerDataRaw = fflate.unzipSync(this.data, {
			filter: (file) => file.name === "META-INF/container.xml",
		});
		const containerXml = this.decoder.decode(containerDataRaw["META-INF/container.xml"]);
		if (!containerXml) throw new Error("META-INF/container.xml not found or empty");

		const containerParsed = this.parser.parse(containerXml);
		const rootFile = containerParsed.container.rootfiles.rootfile["@_full-path"];
		const rootDir = rootFile.includes("/") ? rootFile.substring(0, rootFile.lastIndexOf("/") + 1) : "";

		// 2. 解析 OPF 内容
		const opfDataRaw = fflate.unzipSync(this.data, {
			filter: (file) => file.name === rootFile,
		});
		const opfXml = this.decoder.decode(opfDataRaw[rootFile]);
		if (!opfXml) throw new Error(`OPF file not found at ${rootFile}`);

		const opfData = this.parser.parse(opfXml);
		const metadata = opfData.package.metadata;
		const manifestItems = Array.isArray(opfData.package.manifest.item)
			? opfData.package.manifest.item
			: [opfData.package.manifest.item];
		const spineItems = Array.isArray(opfData.package.spine.itemref)
			? opfData.package.spine.itemref
			: [opfData.package.spine.itemref];

		// 建立 Manifest 映射 (ID -> { Href, MediaType })
		const manifestMap = new Map<string, { href: string; mediaType: string }>();
		manifestItems.forEach((item: any) => {
			manifestMap.set(item["@_id"], {
				href: item["@_href"],
				mediaType: item["@_media-type"]
			});
		});

		// 3. 提取元数据
		const title = this.extractValue(metadata["dc:title"]);
		const author = this.extractValue(metadata["dc:creator"]);
		const publishDate = this.extractValue(metadata["dc:date"]);

		// 4. 寻找 TOC 文件
		let tocFile = "";
		let tocType: "ncx" | "nav" | null = null;

		// 优先查找 EPUB 3 的 NAV 导航 (在 manifest 中查找具有 properties="nav" 的项)
		const navItem = manifestItems.find((item: any) => item["@_properties"] === "nav");
		if (navItem) {
			tocFile = rootDir + navItem["@_href"];
			tocType = "nav";
		} else {
			// 查找 EPUB 2 的 NCX 导航 (从 spine 的 toc 属性获取 ID，再从 manifest 中查找)
			const tocId = opfData.package.spine["@_toc"];
			const ncxItem = manifestItems.find((item: any) => item["@_id"] === tocId);
			if (ncxItem) {
				tocFile = rootDir + ncxItem["@_href"];
				tocType = "ncx";
			}
		}

		// 5. 提取嵌套章节结构
		let chapters: Chapter[] = [];
		if (tocFile && tocType) {
			try {
				const tocDataRaw = fflate.unzipSync(this.data!, { filter: (file) => file.name === tocFile });
				const tocXml = this.decoder.decode(tocDataRaw[tocFile]);
				if (tocXml) {
					const tocParsed = this.parser.parse(tocXml);
					if (tocType === "ncx") {
						chapters = this.parseNcx(tocParsed);
					} else {
						chapters = this.parseNav(tocParsed);
					}
				}
			} catch (e) {
				console.warn(`[EpubParser] Failed to parse TOC file ${tocFile}: ${e}`);
			}
		}

		// 6. 如果目录为空，则退而求其次使用 Spine 列表 (扁平)
		if (chapters.length === 0) {
			chapters = spineItems
				.map((ref: any) => {
					const idref = ref["@_idref"];
					const item = manifestMap.get(idref);
					if (!item) return null;
					return {
						title: idref,
						path: item.href, // 保持相对于 rootDir
						level: 0,
						children: [],
					};
				})
				.filter(Boolean) as Chapter[];
		}

		// 7. 提取封面图
		let coverPath = "";
		let coverMime = "";
		const metaItems = Array.isArray(metadata.meta) ? metadata.meta : [metadata.meta];
		const coverMeta = metaItems.find((m: any) => m && m["@_name"] === "cover");
		if (coverMeta) {
			const coverId = coverMeta["@_content"];
			const item = manifestMap.get(coverId);
			if (item) {
				coverPath = rootDir + item.href;
				coverMime = item.mediaType;
			}
		}

		if (!coverPath) {
			const coverItem = manifestItems.find(
				(item: any) =>
					item["@_id"]?.toLowerCase().includes("cover") || item["@_href"]?.toLowerCase().includes("cover")
			);
			if (coverItem) {
				coverPath = rootDir + coverItem["@_href"];
				coverMime = coverItem["@_media-type"];
			}
		}

		return {
			title: title || "Unknown Title",
			author: author || "Unknown Author",
			publishDate: publishDate || "",
			coverPath,
			coverMime,
			chapters,
			rootDir
		};
	}

	/**
	 * 递归解析 NCX 导航文件
	 */
	private parseNcx(data: any, level = 0): Chapter[] {
		const navPoints = data.ncx?.navMap?.navPoint;
		if (!navPoints) return [];

		const transform = (point: any, currentLevel: number): Chapter => {
			const src = point.content?.["@_src"] || "";
			const children = point.navPoint
				? (Array.isArray(point.navPoint)
					? point.navPoint.map((p: any) => transform(p, currentLevel + 1))
					: [transform(point.navPoint, currentLevel + 1)])
				: [];

			return {
				title: this.extractValue(point.navLabel?.text) || "Untitled",
				path: src.split("#")[0],
				level: currentLevel,
				children: children
			};
		};

		return Array.isArray(navPoints)
			? navPoints.map(p => transform(p, level))
			: [transform(navPoints, level)];
	}

	/**
	 * 递归解析 NAV 导航文件 (简化版)
	 */
	private parseNav(data: any): Chapter[] {
		// EPUB 3 的 NAV 结构通常是 <nav><ol><li><a href="...">...</a><ol>...</ol></li></ol></nav>
		const findNav = (node: any): any => {
			if (!node) return null;
			if (node.nav) return node.nav;
			for (const key in node) {
				if (typeof node[key] === "object") {
					const res = findNav(node[key]);
					if (res) return res;
				}
			}
			return null;
		};

		const navNode = findNav(data.html?.body || data);
		if (!navNode) return [];

		const parseList = (ol: any, level: number): Chapter[] => {
			if (!ol || !ol.li) return [];
			const items = Array.isArray(ol.li) ? ol.li : [ol.li];

			return items.map((li: any) => {
				const a = li.a;
				const title = a ? this.extractValue(a) : "Untitled";
				const href = a ? a["@_href"] : "";
				const subOl = li.ol;

				return {
					title,
					path: href.split("#")[0],
					level,
					children: subOl ? parseList(subOl, level + 1) : []
				};
			});
		};

		const topOl = navNode.ol;
		return topOl ? parseList(topOl, 0) : [];
	}

	/**
	 * 辅助方法：从 XML 节点中提取文本值
	 */
	private extractValue(node: any): string {
		if (!node) return "";
		if (typeof node === "string") return node;
		if (Array.isArray(node)) return this.extractValue(node[0]);
		if (typeof node === "object") {
			return node["#text"] || node["@_value"] || "";
		}
		return String(node);
	}

	/**
	 * 获取 ZIP 内部的原始文件内容（供后续按需读取使用）
	 */
	async getFile(path: string, type: "string"): Promise<string | null>;
	async getFile(path: string, type: "uint8array"): Promise<Uint8Array | null>;
	async getFile(path: string, type: "arraybuffer"): Promise<ArrayBuffer | null>;
	async getFile(path: string, type: "string" | "arraybuffer" | "uint8array" = "string"): Promise<string | Uint8Array | ArrayBuffer | null> {
		if (!this.data) throw new Error("File data not loaded");

		const result = fflate.unzipSync(this.data, {
			filter: (file) => file.name === path,
		});

		const content = result[path];
		if (!content) return null;

		if (type === "string") return this.decoder.decode(content);
		if (type === "uint8array") return content;
		if (type === "arraybuffer") return content.buffer as ArrayBuffer;
		return content;
	}
}
