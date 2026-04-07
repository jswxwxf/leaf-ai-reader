import * as fflate from "fflate";
import { XMLParser } from "fast-xml-parser";

/**
 * EPUB 解析器：负责从 EPUB 文件中提取元数据、封面路径和章节列表
 * 使用 fflate 替换 JSZip，以获得更好的性能和更小的体积，满足 Cloudflare Workers 限制
 */
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

		// 建立 Manifest 映射 (ID -> Href)
		const manifestMap = new Map<string, string>();
		manifestItems.forEach((item: any) => {
			manifestMap.set(item["@_id"], item["@_href"]);
		});

		// 3. 提取元数据
		const title = this.extractValue(metadata["dc:title"]);
		const author = this.extractValue(metadata["dc:creator"]);
		const publishDate = this.extractValue(metadata["dc:date"]);

		// 4. 寻找封面图路径
		let coverPath = "";
		const metaItems = Array.isArray(metadata.meta) ? metadata.meta : [metadata.meta];
		const coverMeta = metaItems.find((m: any) => m && m["@_name"] === "cover");
		if (coverMeta) {
			const coverId = coverMeta["@_content"];
			const href = manifestMap.get(coverId);
			if (href) coverPath = rootDir + href;
		}

		if (!coverPath) {
			const coverItem = manifestItems.find(
				(item: any) =>
					item["@_id"]?.toLowerCase().includes("cover") || item["@_href"]?.toLowerCase().includes("cover")
			);
			if (coverItem) {
				coverPath = rootDir + coverItem["@_href"];
			}
		}

		// 5. 提取章节列表 (遵循 Spine 顺序)
		const chapters = spineItems
			.map((ref: any) => {
				const idref = ref["@_idref"];
				const href = manifestMap.get(idref);
				if (!href) return null;
				return {
					id: idref,
					path: rootDir + href,
				};
			})
			.filter(Boolean);

		return {
			title: title || "Unknown Title",
			author: author || "Unknown Author",
			publishDate: publishDate || "",
			coverPath,
			chapters,
		};
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

