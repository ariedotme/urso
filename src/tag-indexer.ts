import { App, TFile } from "obsidian";
import {
	IndexedTagData,
	NotesInheritanceMode,
	PropertyNode,
	TagNode,
	TrackedPropertySetting,
	UNTAGGED_KEY,
	UntaggedPosition,
} from "./models";

interface MutableTagNode extends TagNode {
	childMap: Map<string, MutableTagNode>;
}

interface MutablePropertyNode extends PropertyNode {
	childMap: Map<string, MutablePropertyNode>;
}

interface FileCacheShape {
	tags?: Array<{ tag: string }>;
	frontmatter?: Record<string, unknown>;
}

export class TagIndexer {
	constructor(private readonly app: App) {}

	build(
		inheritanceMode: NotesInheritanceMode,
		showUntagged: boolean,
		untaggedLabel: string,
		untaggedPosition: UntaggedPosition,
		trackedProperties: TrackedPropertySetting[],
	): IndexedTagData {
		const rootMap = new Map<string, MutableTagNode>();
		const notesByTagInternal = new Map<string, Map<string, TFile>>();
		const propertyRoots = this.createPropertyRoots(trackedProperties);
		const notesByPropertyInternal = new Map<string, Map<string, TFile>>();
		const untaggedNotes: TFile[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(file) as FileCacheShape | null;
			const normalizedTags = this.getNormalizedTags(cache);

			if (normalizedTags.size === 0) {
				untaggedNotes.push(file);
			} else {
				for (const tag of normalizedTags) {
					const parts = tag.split("/");
					this.ensureTagNode(rootMap, parts);

					if (inheritanceMode === "leaf-only") {
						this.pushNote(notesByTagInternal, tag, file);
						continue;
					}

					for (let index = 1; index <= parts.length; index++) {
						const ancestorPath = parts.slice(0, index).join("/");
						this.pushNote(notesByTagInternal, ancestorPath, file);
					}
				}
			}

			this.indexTrackedProperties(file, cache?.frontmatter, trackedProperties, propertyRoots, notesByPropertyInternal);
		}

		const tagTree = Array.from(rootMap.values());
		this.sortTagTree(tagTree);
		this.assignTagCounts(tagTree, notesByTagInternal);

		const propertyTree = Array.from(propertyRoots.values());
		this.sortPropertyTree(propertyTree);
		this.assignPropertyCounts(propertyTree, notesByPropertyInternal);

		untaggedNotes.sort((left, right) => this.compareFiles(left, right));

		const notesByTag = new Map<string, TFile[]>();
		for (const [tagPath, fileMap] of notesByTagInternal) {
			notesByTag.set(
				tagPath,
				Array.from(fileMap.values()).sort((left, right) => this.compareFiles(left, right)),
			);
		}

		const notesByProperty = new Map<string, TFile[]>();
		for (const [propertyPath, fileMap] of notesByPropertyInternal) {
			notesByProperty.set(
				propertyPath,
				Array.from(fileMap.values()).sort((left, right) => this.compareFiles(left, right)),
			);
		}

		const resultTagTree: TagNode[] = [...tagTree];
		if (showUntagged) {
			const specialNode: TagNode = {
				key: UNTAGGED_KEY,
				name: untaggedLabel,
				fullPath: UNTAGGED_KEY,
				children: [],
				noteCount: untaggedNotes.length,
				isSpecial: true,
			};

			if (untaggedPosition === "top") {
				resultTagTree.unshift(specialNode);
			} else {
				resultTagTree.push(specialNode);
			}

			notesByTag.set(UNTAGGED_KEY, [...untaggedNotes]);
		}

		return {
			tagTree: resultTagTree,
			notesByTag,
			propertyTree,
			notesByProperty,
			untaggedNotes,
		};
	}

	private createPropertyRoots(trackedProperties: TrackedPropertySetting[]): Map<string, MutablePropertyNode> {
		const propertyRoots = new Map<string, MutablePropertyNode>();
		for (const trackedProperty of trackedProperties) {
			propertyRoots.set(trackedProperty.propertyKey, {
				key: this.getPropertyRootKey(trackedProperty.propertyKey),
				name: trackedProperty.propertyKey,
				propertyKey: trackedProperty.propertyKey,
				children: [],
				noteCount: 0,
				childMap: new Map(),
			});
		}

		return propertyRoots;
	}

	private indexTrackedProperties(
		file: TFile,
		frontmatter: Record<string, unknown> | undefined,
		trackedProperties: TrackedPropertySetting[],
		propertyRoots: Map<string, MutablePropertyNode>,
		notesByPropertyInternal: Map<string, Map<string, TFile>>,
	): void {
		if (!frontmatter) {
			return;
		}

		for (const trackedProperty of trackedProperties) {
			if (!Object.prototype.hasOwnProperty.call(frontmatter, trackedProperty.propertyKey)) {
				continue;
			}

			const rootNode = propertyRoots.get(trackedProperty.propertyKey);
			if (!rootNode) {
				continue;
			}

			this.pushNote(notesByPropertyInternal, rootNode.key, file);

			if (trackedProperty.mode !== "values") {
				continue;
			}

			const values = this.getPropertyValues(frontmatter[trackedProperty.propertyKey]);
			for (const value of values) {
				const childNode = this.ensurePropertyValueNode(rootNode, trackedProperty.propertyKey, value);
				this.pushNote(notesByPropertyInternal, childNode.key, file);
			}
		}
	}

	private getNormalizedTags(cache: FileCacheShape | null): Set<string> {
		const inlineTags = cache?.tags?.map((entry) => entry.tag) ?? [];
		const frontmatterTags = this.getFrontmatterTags(cache?.frontmatter?.tags);
		const normalizedTags = new Set<string>();

		for (const rawTag of [...inlineTags, ...frontmatterTags]) {
			const normalized = this.normalizeTag(rawTag);
			if (normalized) {
				normalizedTags.add(normalized);
			}
		}

		return normalizedTags;
	}

	private getFrontmatterTags(rawTags: unknown): string[] {
		if (Array.isArray(rawTags)) {
			return rawTags.map((entry) => String(entry));
		}

		if (typeof rawTags === "string") {
			return [rawTags];
		}

		return [];
	}

	private getPropertyValues(rawValue: unknown): string[] {
		const collectedValues: string[] = [];
		this.collectPropertyValues(rawValue, collectedValues);

		const normalizedValues = new Set<string>();
		for (const value of collectedValues) {
			const normalizedValue = value.trim();
			if (normalizedValue) {
				normalizedValues.add(normalizedValue);
			}
		}

		return Array.from(normalizedValues.values());
	}

	private collectPropertyValues(rawValue: unknown, collectedValues: string[]): void {
		if (Array.isArray(rawValue)) {
			for (const entry of rawValue) {
				this.collectPropertyValues(entry, collectedValues);
			}
			return;
		}

		if (rawValue === null || rawValue === undefined) {
			return;
		}

		if (typeof rawValue === "object") {
			collectedValues.push(JSON.stringify(rawValue));
			return;
		}

		if (typeof rawValue === "string") {
			collectedValues.push(rawValue);
			return;
		}

		if (typeof rawValue === "number" || typeof rawValue === "boolean" || typeof rawValue === "bigint") {
			collectedValues.push(`${rawValue}`);
			return;
		}

		if (typeof rawValue === "symbol") {
			collectedValues.push(rawValue.description ?? rawValue.toString());
		}
	}

	private normalizeTag(rawTag: string): string | null {
		const strippedTag = rawTag.replace(/^#/, "").trim();
		if (!strippedTag) {
			return null;
		}

		const parts = strippedTag
			.split("/")
			.map((part) => part.trim())
			.filter(Boolean);

		if (parts.length === 0) {
			return null;
		}

		return parts.join("/");
	}

	private ensureTagNode(rootMap: Map<string, MutableTagNode>, parts: string[]): MutableTagNode {
		let currentMap = rootMap;
		let currentNode: MutableTagNode | null = null;
		let fullPath = "";

		for (const part of parts) {
			fullPath = fullPath ? `${fullPath}/${part}` : part;

			let node = currentMap.get(part);
			if (!node) {
				node = {
					key: fullPath,
					name: part,
					fullPath,
					children: [],
					noteCount: 0,
					childMap: new Map(),
				};
				currentMap.set(part, node);

				if (currentNode) {
					currentNode.children.push(node);
				}
			}

			currentNode = node;
			currentMap = node.childMap;
		}

		return currentNode!;
	}

	private ensurePropertyValueNode(
		rootNode: MutablePropertyNode,
		propertyKey: string,
		propertyValue: string,
	): MutablePropertyNode {
		const childKey = this.getPropertyValueKey(propertyKey, propertyValue);
		let childNode = rootNode.childMap.get(childKey);
		if (!childNode) {
			childNode = {
				key: childKey,
				name: propertyValue,
				propertyKey,
				propertyValue,
				children: [],
				noteCount: 0,
				childMap: new Map(),
			};
			rootNode.childMap.set(childKey, childNode);
			rootNode.children.push(childNode);
		}

		return childNode;
	}

	private getPropertyRootKey(propertyKey: string): string {
		return `property:${encodeURIComponent(propertyKey)}`;
	}

	private getPropertyValueKey(propertyKey: string, propertyValue: string): string {
		return `${this.getPropertyRootKey(propertyKey)}/value:${encodeURIComponent(propertyValue)}`;
	}

	private pushNote(notesByKeyInternal: Map<string, Map<string, TFile>>, key: string, file: TFile): void {
		const fileMap = notesByKeyInternal.get(key) ?? new Map<string, TFile>();
		fileMap.set(file.path, file);
		notesByKeyInternal.set(key, fileMap);
	}

	private sortTagTree(nodes: MutableTagNode[]): void {
		nodes.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
		for (const node of nodes) {
			this.sortTagTree(node.children as MutableTagNode[]);
		}
	}

	private sortPropertyTree(nodes: MutablePropertyNode[]): void {
		nodes.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
		for (const node of nodes) {
			this.sortPropertyTree(node.children as MutablePropertyNode[]);
		}
	}

	private assignTagCounts(
		nodes: MutableTagNode[],
		notesByTagInternal: Map<string, Map<string, TFile>>,
	): void {
		for (const node of nodes) {
			node.noteCount = notesByTagInternal.get(node.fullPath)?.size ?? 0;
			this.assignTagCounts(node.children as MutableTagNode[], notesByTagInternal);
		}
	}

	private assignPropertyCounts(
		nodes: MutablePropertyNode[],
		notesByPropertyInternal: Map<string, Map<string, TFile>>,
	): void {
		for (const node of nodes) {
			node.noteCount = notesByPropertyInternal.get(node.key)?.size ?? 0;
			this.assignPropertyCounts(node.children as MutablePropertyNode[], notesByPropertyInternal);
		}
	}

	private compareFiles(this: void, left: TFile, right: TFile): number {
		return left.path.localeCompare(right.path, undefined, { sensitivity: "base" });
	}
}
