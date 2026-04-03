import { Debouncer, debounce, moment, normalizePath, Notice, Plugin, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import {
	CreateNoteContext,
	IndexedTagData,
	PrimaryViewMode,
	PropertyNode,
	TagNode,
	TrackedPropertyMode,
	TrackedPropertySetting,
	VIEW_TYPE_URSO,
	UrsoPluginSettings,
} from "./models";
import { DEFAULT_SETTINGS, UrsoSettingTab } from "./settings";
import { TagIndexer } from "./tag-indexer";
import { UrsoView } from "./views/urso-tags-view";

interface InternalTabsGroup {
	children: WorkspaceLeaf[];
	currentTab?: number;
	insertChild(index: number, leaf: WorkspaceLeaf): void;
	removeChild(leaf: WorkspaceLeaf): void;
	selectTabIndex?(index: number): void;
}

interface InternalCommandManager {
	executeCommandById(commandId: string, event?: Event): boolean;
}

interface InternalCommandApp {
	commands?: InternalCommandManager;
}

interface InternalPinnedLeaf extends WorkspaceLeaf {
	pinned?: boolean;
}

export default class UrsoPlugin extends Plugin {
	settings: UrsoPluginSettings;
	index: IndexedTagData;

	private indexer: TagIndexer;
	private lastNavigableLeaf: WorkspaceLeaf | null = null;
	private debouncedRefresh: Debouncer<[], void>;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.indexer = new TagIndexer(this.app);
		this.index = this.buildIndex();
		this.lastNavigableLeaf = this.getTrackedLeaf(this.app.workspace.getMostRecentLeaf());
		this.debouncedRefresh = debounce(() => {
			void this.rebuildIndexAndRefresh();
		}, 250, true);

		this.registerView(VIEW_TYPE_URSO, (leaf) => new UrsoView(leaf, this));
		this.addSettingTab(new UrsoSettingTab(this.app, this));

		this.addCommand({
			id: "open-view",
			name: "Open view",
			callback: () => {
				void this.activateView();
			},
		});
		this.addCommand({
			id: "create-note-in-selected-tag",
			name: "Create note in selected tag or property",
			callback: () => {
				void this.createNoteInSelectedContext();
			},
		});

		this.registerEvent(this.app.vault.on("create", () => this.debouncedRefresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.debouncedRefresh()));
		this.registerEvent(this.app.vault.on("modify", () => this.debouncedRefresh()));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					void this.handleFileRename(file, oldPath);
				}

				this.debouncedRefresh();
			}),
		);
		this.registerEvent(this.app.metadataCache.on("changed", () => this.debouncedRefresh()));
		this.registerEvent(this.app.metadataCache.on("resolved", () => this.debouncedRefresh()));
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				const trackedLeaf = this.getTrackedLeaf(leaf);
				if (trackedLeaf) {
					this.lastNavigableLeaf = trackedLeaf;
				}
			}),
		);

		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
		});
	}

	onunload(): void {
		this.debouncedRefresh?.cancel();
	}

	async loadSettings(): Promise<void> {
		const loadedDataRaw: unknown = await this.loadData();
		const loadedData = (loadedDataRaw ?? {}) as Partial<UrsoPluginSettings>;
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedData,
			hiddenTags: this.normalizeHiddenTags(loadedData.hiddenTags),
			primaryViewMode: this.normalizePrimaryViewMode(loadedData.primaryViewMode),
			trackedProperties: this.normalizeTrackedProperties(loadedData.trackedProperties),
		};
		delete (this.settings as unknown as { showNotePreviewLine?: unknown }).showNotePreviewLine;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	getPrimaryViewMode(): PrimaryViewMode {
		return this.settings.primaryViewMode;
	}

	async setPrimaryViewMode(mode: PrimaryViewMode): Promise<void> {
		if (this.settings.primaryViewMode === mode) {
			return;
		}

		this.settings.primaryViewMode = mode;
		await this.saveSettings();
	}

	getTagIcon(tagKey: string): string | null {
		const iconName = this.settings.tagIcons[tagKey];
		return iconName ? iconName : null;
	}

	getPropertyIcon(propertyNodeKey: string): string | null {
		const iconName = this.settings.propertyIcons[propertyNodeKey];
		return iconName ? iconName : null;
	}

	getManageableTagKeys(): string[] {
		const tagKeys = new Set<string>();
		this.collectTagKeys(this.index.tagTree, tagKeys, { includeSpecial: false });
		return Array.from(tagKeys).sort((left, right) => left.localeCompare(right));
	}

	getHiddenTags(): string[] {
		return [...this.settings.hiddenTags];
	}

	getTrackedProperties(): TrackedPropertySetting[] {
		return [...this.settings.trackedProperties];
	}

	getAvailablePropertyKeys(): string[] {
		const propertyKeys = new Set(this.settings.trackedProperties.map((entry) => entry.propertyKey));
		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) {
				continue;
			}

			for (const propertyKey of Object.keys(frontmatter)) {
				if (this.isTrackablePropertyKey(propertyKey)) {
					propertyKeys.add(propertyKey);
				}
			}
		}

		return Array.from(propertyKeys).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
	}

	getNoteIcon(notePath: string): string | null {
		const iconName = this.settings.noteIcons[notePath];
		return iconName ? iconName : null;
	}

	isTagHidden(tagKey: string): boolean {
		return this.settings.hiddenTags.includes(tagKey);
	}

	isTagPinned(tagKey: string): boolean {
		return this.settings.pinnedTags.includes(tagKey);
	}

	isPropertyPinned(propertyNodeKey: string): boolean {
		return this.settings.pinnedProperties.includes(propertyNodeKey);
	}

	async hideTag(tagKey: string): Promise<void> {
		await this.upsertHiddenTag(tagKey);
	}

	async unhideTag(tagKey: string): Promise<void> {
		await this.removeHiddenTag(tagKey);
	}

	async upsertHiddenTag(nextTagKey: string, previousTagKey?: string): Promise<boolean> {
		const tagKey = this.normalizeHiddenTagKey(nextTagKey);
		if (!tagKey) {
			new Notice("Enter a valid tag name.");
			return false;
		}

		const previousNormalizedTagKey = previousTagKey ? this.normalizeHiddenTagKey(previousTagKey) : null;
		const nextHiddenTags: string[] = [];
		let didReplace = false;

		for (const hiddenTag of this.settings.hiddenTags) {
			if (hiddenTag === tagKey || (previousNormalizedTagKey && hiddenTag === previousNormalizedTagKey)) {
				if (!didReplace) {
					nextHiddenTags.push(tagKey);
					didReplace = true;
				}
				continue;
			}

			nextHiddenTags.push(hiddenTag);
		}

		if (!didReplace) {
			nextHiddenTags.push(tagKey);
		}

		this.settings.hiddenTags = this.normalizeHiddenTags(nextHiddenTags);
		await this.saveSettings();
		this.refreshViews();
		return true;
	}

	async removeHiddenTag(tagKey: string): Promise<void> {
		const normalizedTagKey = this.normalizeHiddenTagKey(tagKey);
		if (!normalizedTagKey) {
			return;
		}

		this.settings.hiddenTags = this.settings.hiddenTags.filter((entry) => entry !== normalizedTagKey);
		await this.saveSettings();
		this.refreshViews();
	}

	async toggleTagPin(tagKey: string): Promise<void> {
		if (this.isTagPinned(tagKey)) {
			this.settings.pinnedTags = this.settings.pinnedTags.filter((entry) => entry !== tagKey);
		} else {
			this.settings.pinnedTags = [...this.settings.pinnedTags, tagKey];
		}

		await this.saveSettings();
		this.refreshViews();
	}

	async togglePropertyPin(propertyNodeKey: string): Promise<void> {
		if (this.isPropertyPinned(propertyNodeKey)) {
			this.settings.pinnedProperties = this.settings.pinnedProperties.filter((entry) => entry !== propertyNodeKey);
		} else {
			this.settings.pinnedProperties = [...this.settings.pinnedProperties, propertyNodeKey];
		}

		await this.saveSettings();
		this.refreshViews();
	}

	getPinnedNotePaths(tagKey: string): string[] {
		return this.settings.pinnedNotes[tagKey] ?? [];
	}

	isNotePinned(tagKey: string, filePath: string): boolean {
		return this.getPinnedNotePaths(tagKey).includes(filePath);
	}

	async toggleNotePin(tagKey: string, filePath: string): Promise<void> {
		const pinnedPaths = this.settings.pinnedNotes[tagKey] ?? [];
		if (pinnedPaths.includes(filePath)) {
			const nextPinnedPaths = pinnedPaths.filter((path) => path !== filePath);
			if (nextPinnedPaths.length > 0) {
				this.settings.pinnedNotes[tagKey] = nextPinnedPaths;
			} else {
				delete this.settings.pinnedNotes[tagKey];
			}
		} else {
			this.settings.pinnedNotes[tagKey] = [...pinnedPaths, filePath];
		}

		await this.saveSettings();
		this.refreshViews();
	}

	async setTagIcon(tagKey: string, iconName: string | null): Promise<void> {
		if (iconName) {
			this.settings.tagIcons[tagKey] = iconName;
		} else {
			delete this.settings.tagIcons[tagKey];
		}

		await this.saveSettings();
		this.refreshViews();
	}

	async setPropertyIcon(propertyNodeKey: string, iconName: string | null): Promise<void> {
		if (iconName) {
			this.settings.propertyIcons[propertyNodeKey] = iconName;
		} else {
			delete this.settings.propertyIcons[propertyNodeKey];
		}

		await this.saveSettings();
		this.refreshViews();
	}

	async setNoteIcon(notePath: string, iconName: string | null): Promise<void> {
		if (iconName) {
			this.settings.noteIcons[notePath] = iconName;
		} else {
			delete this.settings.noteIcons[notePath];
		}

		await this.saveSettings();
		this.refreshViews();
	}

	async upsertTrackedProperty(
		nextProperty: TrackedPropertySetting,
		previousPropertyKey?: string,
	): Promise<boolean> {
		const propertyKey = nextProperty.propertyKey.trim();
		if (!this.isTrackablePropertyKey(propertyKey)) {
			new Notice("Enter a valid property name.");
			return false;
		}

		const mode: TrackedPropertyMode = nextProperty.mode === "values" ? "values" : "notes";
		const targetKey = previousPropertyKey?.trim() || propertyKey;
		const nextTrackedProperties: TrackedPropertySetting[] = [];
		let didReplace = false;

		for (const trackedProperty of this.settings.trackedProperties) {
			if (trackedProperty.propertyKey === targetKey || trackedProperty.propertyKey === propertyKey) {
				if (!didReplace) {
					nextTrackedProperties.push({ propertyKey, mode });
					didReplace = true;
				}
				continue;
			}

			nextTrackedProperties.push(trackedProperty);
		}

		if (!didReplace) {
			nextTrackedProperties.push({ propertyKey, mode });
		}

		this.settings.trackedProperties = this.normalizeTrackedProperties(nextTrackedProperties);
		await this.saveSettings();
		await this.rebuildIndexAndRefresh();
		return true;
	}

	async removeTrackedProperty(propertyKey: string): Promise<void> {
		const nextTrackedProperties = this.settings.trackedProperties.filter((entry) => entry.propertyKey !== propertyKey);
		if (nextTrackedProperties.length === this.settings.trackedProperties.length) {
			return;
		}

		this.settings.trackedProperties = nextTrackedProperties;
		await this.saveSettings();
		await this.rebuildIndexAndRefresh();
	}

	async deleteNote(file: TFile): Promise<void> {
		await this.app.fileManager.trashFile(file);
		const didChange = this.removeNoteState(file.path);

		if (didChange) {
			await this.saveSettings();
		}
	}

	formatNoteDate(file: TFile): string {
		return moment(this.getNoteDateTimestamp(file)).format(this.getNoteDateFormat());
	}

	getNoteSecondaryLine(file: TFile): string | null {
		if (this.settings.noteSecondaryLineMode === "none") {
			return null;
		}

		return this.formatNoteDate(file);
	}

	buildIndex(): IndexedTagData {
		return this.indexer.build(
			this.settings.inheritanceMode,
			this.settings.showUntagged,
			this.settings.untaggedLabel,
			this.settings.untaggedPosition,
			this.settings.trackedProperties,
		);
	}

	async rebuildIndexAndRefresh(): Promise<void> {
		this.index = this.buildIndex();
		await this.pruneStoredState();
		this.refreshViews();
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_URSO)) {
			if (leaf.view instanceof UrsoView) {
				leaf.view.refresh();
			}
		}
	}

	findTagNode(nodes: TagNode[], tagKey: string): TagNode | null {
		for (const node of nodes) {
			if (node.key === tagKey) {
				return node;
			}

			const childMatch = this.findTagNode(node.children, tagKey);
			if (childMatch) {
				return childMatch;
			}
		}

		return null;
	}

	async activateView(): Promise<void> {
		const leaf = await this.getOrCreateViewLeaf();
		if (!leaf) {
			return;
		}

		await this.app.workspace.revealLeaf(leaf);
	}

	async createNoteInSelectedContext(): Promise<void> {
		const view = this.getOpenUrsoView();
		const createContext = view?.getSelectedCreateContext() ?? null;

		if (!createContext) {
			new Notice("Select a tag or property first.");
			return;
		}

		const file = await this.createContextualNote(createContext);
		const targetLeaf = (view && this.resolveCloseTargetLeaf(view.leaf)) ?? this.app.workspace.getLeaf("tab");
		await this.openCreatedNote(file, targetLeaf);
	}

	async closeLastNavigableLeaf(sourceLeaf: WorkspaceLeaf, event?: KeyboardEvent): Promise<boolean> {
		const targetLeaf = this.resolveCloseTargetLeaf(sourceLeaf);
		if (!targetLeaf) {
			return false;
		}

		const commandManager = (this.app as typeof this.app & InternalCommandApp).commands;
		if (commandManager) {
			this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
			await window.activeWindow.nextFrame();

			if (commandManager.executeCommandById("workspace:close", event)) {
				return true;
			}
		}

		if (targetLeaf === this.lastNavigableLeaf) {
			this.lastNavigableLeaf = null;
		}
		targetLeaf.detach();
		return true;
	}

	private async getOrCreateViewLeaf(): Promise<WorkspaceLeaf | null> {
		const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_URSO);
		const preferredLeaf = existingLeaves.find((leaf) => this.isLeafInLeftSidebar(leaf)) ?? null;

		if (preferredLeaf) {
			this.pinSidebarLeaf(preferredLeaf);

			for (const leaf of existingLeaves) {
				if (leaf !== preferredLeaf) {
					leaf.detach();
				}
			}

			this.app.workspace.leftSplit.expand();
			return preferredLeaf;
		}

		const targetLeaf = this.app.workspace.getLeftLeaf(false) ?? this.app.workspace.getLeftLeaf(true);
		if (!targetLeaf) {
			return null;
		}

		await targetLeaf.setViewState({
			type: VIEW_TYPE_URSO,
			active: true,
		});

		this.pinSidebarLeaf(targetLeaf);
		this.moveLeafToFrontOfLeftSidebar(targetLeaf);

		for (const leaf of existingLeaves) {
			if (leaf !== targetLeaf) {
				leaf.detach();
			}
		}

		this.app.workspace.leftSplit.expand();
		return targetLeaf;
	}

	private pinSidebarLeaf(leaf: WorkspaceLeaf): void {
		const pinnedLeaf = leaf as InternalPinnedLeaf;
		if (!this.isLeafInLeftSidebar(leaf) || pinnedLeaf.pinned) {
			return;
		}

		pinnedLeaf.setPinned(true);
	}

	private getOpenUrsoView(): UrsoView | null {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_URSO)) {
			if (leaf.view instanceof UrsoView) {
				return leaf.view;
			}
		}

		return null;
	}

	private async createContextualNote(context: CreateNoteContext): Promise<TFile> {
		const folderPath = this.getResolvedNewNoteFolder();
		const fileContent = this.buildNewNoteContent(context);
		let index = 0;

		while (true) {
			const basename = index === 0 ? "Untitled" : `Untitled ${index}`;
			const filePath = normalizePath(folderPath ? `${folderPath}/${basename}.md` : `${basename}.md`);
			if (!this.app.vault.getAbstractFileByPath(filePath)) {
				return this.app.vault.create(filePath, fileContent);
			}

			index += 1;
		}
	}

	private async openCreatedNote(file: TFile, targetLeaf: WorkspaceLeaf): Promise<void> {
		await targetLeaf.openFile(file);
		this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
		await window.activeWindow.nextFrame();
		targetLeaf.setEphemeralState({ rename: "all" });
	}

	private async handleFileRename(file: TFile, oldPath: string): Promise<void> {
		let didChange = false;

		const iconName = this.settings.noteIcons[oldPath];
		if (iconName) {
			this.settings.noteIcons[file.path] = iconName;
			delete this.settings.noteIcons[oldPath];
			didChange = true;
		}

		for (const [tagKey, filePaths] of Object.entries(this.settings.pinnedNotes)) {
			let changedPaths = false;
			const nextFilePaths: string[] = [];
			const seenPaths = new Set<string>();

			for (const filePath of filePaths) {
				const nextPath = filePath === oldPath ? file.path : filePath;
				if (nextPath !== filePath || seenPaths.has(nextPath)) {
					changedPaths = true;
				}

				if (seenPaths.has(nextPath)) {
					continue;
				}

				seenPaths.add(nextPath);
				nextFilePaths.push(nextPath);
			}

			if (!changedPaths) {
				continue;
			}

			didChange = true;
			if (nextFilePaths.length > 0) {
				this.settings.pinnedNotes[tagKey] = nextFilePaths;
			} else {
				delete this.settings.pinnedNotes[tagKey];
			}
		}

		if (didChange) {
			await this.saveSettings();
		}
	}

	private getResolvedNewNoteFolder(): string {
		const rawFolderPath = this.settings.newNoteFolder.trim();
		if (!rawFolderPath) {
			return "";
		}

		const folderPath = normalizePath(rawFolderPath);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (folder instanceof TFolder) {
			return folder.path;
		}

		new Notice(`Urso folder "${folderPath}" was not found. Using the vault root instead.`);
		return "";
	}

	private buildNewNoteContent(context: CreateNoteContext): string {
		if (context.type === "tag") {
			if (!context.tagKey) {
				return "";
			}

			return `---\ntags:\n  - ${JSON.stringify(context.tagKey)}\n---\n\n`;
		}

		const propertyKey = this.formatYamlKey(context.propertyKey);
		if (context.propertyValue === null) {
			return `---\n${propertyKey}:\n---\n\n`;
		}

		return `---\n${propertyKey}: ${JSON.stringify(context.propertyValue)}\n---\n\n`;
	}

	private formatYamlKey(propertyKey: string): string {
		return /^[A-Za-z0-9_-]+$/u.test(propertyKey) ? propertyKey : JSON.stringify(propertyKey);
	}

	private resolveCloseTargetLeaf(sourceLeaf: WorkspaceLeaf): WorkspaceLeaf | null {
		const candidates = [
			this.lastNavigableLeaf,
			this.app.workspace.getMostRecentLeaf(),
		];

		for (const candidate of candidates) {
			if (this.isClosableNavigableLeaf(candidate, sourceLeaf)) {
				return candidate;
			}
		}

		let fallbackLeaf: WorkspaceLeaf | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!fallbackLeaf && this.isClosableNavigableLeaf(leaf, sourceLeaf)) {
				fallbackLeaf = leaf;
			}
		});

		return fallbackLeaf;
	}

	private isLeafInLeftSidebar(leaf: WorkspaceLeaf): boolean {
		let parent: unknown = leaf.parent;

		while (parent) {
			if (parent === this.app.workspace.leftSplit) {
				return true;
			}

			if (typeof parent !== "object" || !("parent" in parent)) {
				return false;
			}

			parent = (parent as { parent?: unknown }).parent;
		}

		return false;
	}

	private getTrackedLeaf(leaf: WorkspaceLeaf | null): WorkspaceLeaf | null {
		if (!leaf || leaf.getViewState().type === VIEW_TYPE_URSO || !leaf.view.navigation) {
			return null;
		}

		return leaf;
	}

	private isClosableNavigableLeaf(leaf: WorkspaceLeaf | null, sourceLeaf: WorkspaceLeaf): leaf is WorkspaceLeaf {
		return Boolean(
			leaf &&
				leaf !== sourceLeaf &&
				leaf.getViewState().type !== VIEW_TYPE_URSO &&
				leaf.view.navigation &&
				this.isLeafAttached(leaf),
		);
	}

	private isLeafAttached(leaf: WorkspaceLeaf): boolean {
		let isAttached = false;
		this.app.workspace.iterateAllLeaves((candidate) => {
			if (candidate === leaf) {
				isAttached = true;
			}
		});
		return isAttached;
	}

	private moveLeafToFrontOfLeftSidebar(leaf: WorkspaceLeaf): void {
		if (!this.isLeafInLeftSidebar(leaf)) {
			return;
		}

		const tabsGroup = leaf.parent as unknown as InternalTabsGroup;
		if (tabsGroup.children.length <= 1) {
			return;
		}

		const currentIndex = tabsGroup.children.indexOf(leaf);
		if (currentIndex <= 0) {
			if (currentIndex === 0) {
				tabsGroup.selectTabIndex?.(0);
			}
			return;
		}

		tabsGroup.removeChild(leaf);
		tabsGroup.insertChild(0, leaf);

		if (typeof tabsGroup.selectTabIndex === "function") {
			tabsGroup.selectTabIndex(0);
			return;
		}

		tabsGroup.currentTab = 0;
	}

	private async pruneStoredState(): Promise<void> {
		const validTagKeys = new Set<string>();
		this.collectTagKeys(this.index.tagTree, validTagKeys);
		const validPropertyKeys = new Set<string>();
		this.collectPropertyKeys(this.index.propertyTree, validPropertyKeys);
		const validNotePaths = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));

		let didChange = false;

		const nextTagIcons: Record<string, string> = {};
		for (const [tagKey, iconName] of Object.entries(this.settings.tagIcons)) {
			if (validTagKeys.has(tagKey) && iconName) {
				nextTagIcons[tagKey] = iconName;
				continue;
			}

			didChange = true;
		}

		const nextPinnedTags: string[] = [];
		const seenPinnedTags = new Set<string>();
		for (const tagKey of this.settings.pinnedTags) {
			if (!validTagKeys.has(tagKey) || seenPinnedTags.has(tagKey)) {
				didChange = true;
				continue;
			}

			seenPinnedTags.add(tagKey);
			nextPinnedTags.push(tagKey);
		}

		const nextPropertyIcons: Record<string, string> = {};
		for (const [propertyKey, iconName] of Object.entries(this.settings.propertyIcons)) {
			if (validPropertyKeys.has(propertyKey) && iconName) {
				nextPropertyIcons[propertyKey] = iconName;
				continue;
			}

			didChange = true;
		}

		const nextPinnedProperties: string[] = [];
		const seenPinnedProperties = new Set<string>();
		for (const propertyKey of this.settings.pinnedProperties) {
			if (!validPropertyKeys.has(propertyKey) || seenPinnedProperties.has(propertyKey)) {
				didChange = true;
				continue;
			}

			seenPinnedProperties.add(propertyKey);
			nextPinnedProperties.push(propertyKey);
		}

		const nextPinnedNotes: Record<string, string[]> = {};
		for (const [tagKey, filePaths] of Object.entries(this.settings.pinnedNotes)) {
			if (!validTagKeys.has(tagKey)) {
				didChange = true;
				continue;
			}

			const validFiles = new Set((this.index.notesByTag.get(tagKey) ?? []).map((file) => file.path));
			const nextFilePaths: string[] = [];
			const seenFilePaths = new Set<string>();

			for (const filePath of filePaths) {
				if (!validFiles.has(filePath) || seenFilePaths.has(filePath)) {
					didChange = true;
					continue;
				}

				seenFilePaths.add(filePath);
				nextFilePaths.push(filePath);
			}

			if (nextFilePaths.length > 0) {
				nextPinnedNotes[tagKey] = nextFilePaths;
			} else if (filePaths.length > 0) {
				didChange = true;
			}
		}

		const nextNoteIcons: Record<string, string> = {};
		for (const [notePath, iconName] of Object.entries(this.settings.noteIcons)) {
			if (validNotePaths.has(notePath) && iconName) {
				nextNoteIcons[notePath] = iconName;
				continue;
			}

			didChange = true;
		}

		if (!didChange) {
			return;
		}

		this.settings.noteIcons = nextNoteIcons;
		this.settings.propertyIcons = nextPropertyIcons;
		this.settings.tagIcons = nextTagIcons;
		this.settings.pinnedProperties = nextPinnedProperties;
		this.settings.pinnedTags = nextPinnedTags;
		this.settings.pinnedNotes = nextPinnedNotes;
		await this.saveSettings();
	}

	private collectTagKeys(nodes: TagNode[], tagKeys: Set<string>, options?: { includeSpecial?: boolean }): void {
		const includeSpecial = options?.includeSpecial ?? true;
		for (const node of nodes) {
			if (!node.isSpecial || includeSpecial) {
				tagKeys.add(node.key);
			}
			this.collectTagKeys(node.children, tagKeys, options);
		}
	}

	private collectPropertyKeys(nodes: PropertyNode[], propertyKeys: Set<string>): void {
		for (const node of nodes) {
			propertyKeys.add(node.key);
			this.collectPropertyKeys(node.children, propertyKeys);
		}
	}

	private getNoteDateFormat(): string {
		return this.settings.noteDateFormat.trim() || DEFAULT_SETTINGS.noteDateFormat;
	}

	private normalizePrimaryViewMode(rawPrimaryViewMode: unknown): PrimaryViewMode {
		return rawPrimaryViewMode === "properties" ? "properties" : "tags";
	}

	private normalizeHiddenTags(rawHiddenTags: unknown): string[] {
		if (!Array.isArray(rawHiddenTags)) {
			return [...DEFAULT_SETTINGS.hiddenTags];
		}

		const hiddenTags: string[] = [];
		const seenHiddenTags = new Set<string>();
		for (const rawHiddenTag of rawHiddenTags) {
			const hiddenTag = this.normalizeHiddenTagKey(rawHiddenTag);
			if (!hiddenTag || seenHiddenTags.has(hiddenTag)) {
				continue;
			}

			seenHiddenTags.add(hiddenTag);
			hiddenTags.push(hiddenTag);
		}

		return hiddenTags.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
	}

	private normalizeTrackedProperties(rawTrackedProperties: unknown): TrackedPropertySetting[] {
		if (!Array.isArray(rawTrackedProperties)) {
			return [...DEFAULT_SETTINGS.trackedProperties];
		}

		const seenKeys = new Set<string>();
		const trackedProperties: TrackedPropertySetting[] = [];
		for (const entry of rawTrackedProperties) {
			if (!entry || typeof entry !== "object") {
				continue;
			}

			const propertyKey = String((entry as Partial<TrackedPropertySetting>).propertyKey ?? "").trim();
			if (!this.isTrackablePropertyKey(propertyKey) || seenKeys.has(propertyKey)) {
				continue;
			}

			seenKeys.add(propertyKey);
			trackedProperties.push({
				propertyKey,
				mode: (entry as Partial<TrackedPropertySetting>).mode === "values" ? "values" : "notes",
			});
		}

		return trackedProperties.sort((left, right) =>
			left.propertyKey.localeCompare(right.propertyKey, undefined, { sensitivity: "base" }),
		);
	}

	private isTrackablePropertyKey(propertyKey: string): boolean {
		const trimmedKey = propertyKey.trim();
		return Boolean(trimmedKey) && trimmedKey !== "tags" && trimmedKey !== "position";
	}

	private normalizeHiddenTagKey(rawTagKey: unknown): string | null {
		if (typeof rawTagKey !== "string") {
			return null;
		}

		const strippedTag = rawTagKey.replace(/^#/, "").trim();
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

	private getNoteDateTimestamp(file: TFile): number {
		return this.settings.noteSecondaryLineMode === "created-date" ? file.stat.ctime : file.stat.mtime;
	}

	private removeNoteState(notePath: string): boolean {
		let didChange = false;

		if (this.settings.noteIcons[notePath]) {
			delete this.settings.noteIcons[notePath];
			didChange = true;
		}

		for (const [tagKey, filePaths] of Object.entries(this.settings.pinnedNotes)) {
			if (!filePaths.includes(notePath)) {
				continue;
			}

			const nextFilePaths = filePaths.filter((filePath) => filePath !== notePath);
			if (nextFilePaths.length > 0) {
				this.settings.pinnedNotes[tagKey] = nextFilePaths;
			} else {
				delete this.settings.pinnedNotes[tagKey];
			}

			didChange = true;
		}

		return didChange;
	}
}
