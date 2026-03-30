import {
	ItemView,
	Menu,
	Platform,
	Scope,
	setIcon,
	setTooltip,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import UrsoPlugin from "../main";
import { TagIconPickerModal } from "../tag-icon-picker-modal";
import {
	CreateNoteContext,
	PrimaryViewMode,
	PropertyNode,
	TagNode,
	UNTAGGED_KEY,
	VIEW_TYPE_URSO,
} from "../models";

type MobilePane = "main" | "notes";

interface TreeNodeLike {
	key: string;
	name: string;
	children: TreeNodeLike[];
	noteCount: number;
}

export class UrsoView extends ItemView {
	private primaryMode: PrimaryViewMode = "tags";
	private selectedPropertyKey: string | null = null;
	private selectedTagKey: string | null = null;
	private readonly collapsedNodeKeys = new Set<string>();
	private mobilePane: MobilePane = "main";

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: UrsoPlugin,
	) {
		super(leaf);
		this.primaryMode = this.plugin.getPrimaryViewMode();
		this.navigation = false;
		this.scope = new Scope(this.app.scope);
		this.scope.register(["Mod"], "w", (event) => {
			event.preventDefault();
			event.stopPropagation();
			void this.plugin.closeLastNavigableLeaf(this.leaf, event);
			return false;
		});
	}

	getViewType(): string {
		return VIEW_TYPE_URSO;
	}

	getDisplayText(): string {
		return "Urso";
	}

	getIcon(): string {
		return "library";
	}

	getSelectedTagKey(): string | null {
		return this.primaryMode === "tags" ? this.selectedTagKey : null;
	}

	getSelectedCreateContext(): CreateNoteContext | null {
		if (this.primaryMode === "tags") {
			if (!this.selectedTagKey) {
				return null;
			}

			return {
				type: "tag",
				tagKey: this.selectedTagKey === UNTAGGED_KEY ? null : this.selectedTagKey,
			};
		}

		if (!this.selectedPropertyKey) {
			return null;
		}

		const selectedNode = this.findNodeByKey(
			this.plugin.index.propertyTree,
			this.selectedPropertyKey,
		);
		if (!selectedNode) {
			return null;
		}

		return {
			type: "property",
			propertyKey: selectedNode.propertyKey,
			propertyValue: selectedNode.propertyValue ?? null,
		};
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {}

	refresh(): void {
		const visibleTagTree = this.getVisibleTagTree();
		const propertyTree = this.plugin.index.propertyTree;

		if (
			this.selectedTagKey &&
			!this.findNodeByKey(visibleTagTree, this.selectedTagKey)
		) {
			this.selectedTagKey = null;
		}

		if (
			this.selectedPropertyKey &&
			!this.findNodeByKey(propertyTree, this.selectedPropertyKey)
		) {
			this.selectedPropertyKey = null;
		}

		if (!this.getSelectedKeyForMode(this.primaryMode)) {
			this.mobilePane = "main";
		}

		this.pruneCollapsedState(visibleTagTree, propertyTree);
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("urso-tags-view-host");

		const root = contentEl.createDiv({ cls: "urso-tags-view" });
		if (this.plugin.settings.underlinePinnedItems) {
			root.addClass("urso-tags-view--underline-pinned");
		}

		const visibleTagTree = this.getVisibleTagTree();
		if (this.usesSinglePaneLayout()) {
			root.addClass("is-phone-layout");
			if (
				this.mobilePane === "notes" &&
				this.getSelectedKeyForMode(this.primaryMode)
			) {
				const notesPane = root.createDiv({
					cls: ["urso-tags-pane", "urso-tags-pane-right"],
				});
				this.renderNotesPanel(notesPane, visibleTagTree, {
					showBackButton: true,
				});
				return;
			}

			const primaryPane = root.createDiv({
				cls: ["urso-tags-pane", "urso-tags-pane-left"],
			});
			this.renderPrimaryPanel(primaryPane, visibleTagTree);
			return;
		}

		this.applySplitRatio(root, this.plugin.settings.splitPaneRatio);

		const primaryPane = root.createDiv({
			cls: ["urso-tags-pane", "urso-tags-pane-left"],
		});
		const splitter = root.createDiv({ cls: "urso-tags-splitter" });
		const notesPane = root.createDiv({
			cls: ["urso-tags-pane", "urso-tags-pane-right"],
		});

		this.setupSplitResizer(root, splitter);
		this.renderPrimaryPanel(primaryPane, visibleTagTree);
		this.renderNotesPanel(notesPane, visibleTagTree);
	}

	private renderPrimaryPanel(
		container: HTMLElement,
		visibleTagTree: TagNode[],
	): void {
		if (this.primaryMode === "properties") {
			this.renderPropertyTree(container, this.plugin.index.propertyTree);
			return;
		}

		this.renderTagTree(container, visibleTagTree);
	}

	private renderTagTree(container: HTMLElement, nodes: TagNode[]): void {
		this.renderPrimaryHeader(container, "Tags", nodes);

		if (nodes.length === 0) {
			this.renderEmptyState(
				container,
				"No tags found yet.",
				"Add tags to notes to populate this view.",
			);
			return;
		}

		const tree = container.createDiv({ cls: "urso-tags-tree" });
		for (const node of this.getOrderedTagNodes(nodes)) {
			this.renderTagNode(tree, node, 0);
		}
	}

	private renderPropertyTree(
		container: HTMLElement,
		nodes: PropertyNode[],
	): void {
		this.renderPrimaryHeader(container, "Properties", nodes);

		if (this.plugin.settings.trackedProperties.length === 0) {
			this.renderEmptyState(
				container,
				"No properties configured.",
				"Manage tracked properties in Urso settings to populate this view.",
			);
			return;
		}

		const tree = container.createDiv({ cls: "urso-tags-tree" });
		for (const node of this.getOrderedPropertyNodes(nodes)) {
			this.renderPropertyNode(tree, node, 0);
		}
	}

	private renderPrimaryHeader<T extends TreeNodeLike>(
		container: HTMLElement,
		title: string,
		nodes: T[],
	): void {
		const header = container.createDiv({ cls: "urso-tags-header" });
		const headerMain = header.createDiv({ cls: "urso-pane-header-main" });

		const switchButton = headerMain.createEl("button", {
			cls: [
				"clickable-icon",
				"urso-tags-header-button",
				"urso-pane-switcher-button",
			],
			attr: {
				type: "button",
			},
		});
		setIcon(switchButton, "chevron-down");
		setTooltip(switchButton, "Switch between tags and properties");
		switchButton.setAttr(
			"aria-label",
			"Switch between tags and properties",
		);
		switchButton.addEventListener("click", (event) => {
			this.openPrimaryModeMenu(event);
		});

		headerMain.createDiv({ cls: "urso-tags-header-title", text: title });

		const expandableKeys = this.getExpandableNodeKeys(nodes);
		if (expandableKeys.size === 0) {
			return;
		}

		const actions = header.createDiv({ cls: "urso-tags-header-actions" });
		const button = actions.createEl("button", {
			cls: ["clickable-icon", "urso-tags-header-button"],
			attr: {
				type: "button",
			},
		});

		const hasCollapsedBranches = this.hasCollapsedBranches(expandableKeys);
		const icon = hasCollapsedBranches
			? "chevrons-up-down"
			: "chevrons-down-up";
		const label = hasCollapsedBranches ? "Expand all" : "Collapse all";

		setIcon(button, icon);
		setTooltip(button, label);
		button.setAttr("aria-label", label);
		button.addEventListener("click", () => {
			this.toggleAllBranches();
		});
	}

	private renderTagNode(
		container: HTMLElement,
		node: TagNode,
		depth: number,
	): void {
		const row = container.createDiv({ cls: "urso-tags-row" });
		row.style.paddingLeft = `${depth * 16 + 12}px`;

		if (this.selectedTagKey === node.key) {
			row.addClass("is-selected");
		}

		if (this.plugin.isTagPinned(node.key)) {
			row.addClass("is-pinned");
		}

		const main = row.createDiv({ cls: "urso-tags-main" });
		this.renderDisclosure(main, node, "Collapse tag", "Expand tag", () => {
			this.toggleNode(node, "tags");
		});
		this.renderTagIcon(main, node);
		const labelGroup = main.createDiv({ cls: "urso-tags-label-group" });

		labelGroup.createDiv({
			cls: ["urso-tags-label", node.isSpecial ? "is-special" : ""],
			text: node.name,
		});

		if (this.plugin.settings.showCounts) {
			row.createDiv({
				cls: "urso-tags-count",
				text: String(node.noteCount),
			});
		}

		row.addEventListener("click", () => {
			this.selectedTagKey = node.key;
			if (this.usesSinglePaneLayout()) {
				this.mobilePane = "notes";
			}
			this.render();
		});

		row.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.openTagContextMenu(event, node);
		});

		if (this.isExpanded(node)) {
			for (const child of this.getOrderedTagNodes(node.children)) {
				this.renderTagNode(container, child, depth + 1);
			}
		}
	}

	private renderPropertyNode(
		container: HTMLElement,
		node: PropertyNode,
		depth: number,
	): void {
		const row = container.createDiv({ cls: "urso-tags-row" });
		row.style.paddingLeft = `${depth * 16 + 12}px`;

		if (this.selectedPropertyKey === node.key) {
			row.addClass("is-selected");
		}

		if (this.plugin.isPropertyPinned(node.key)) {
			row.addClass("is-pinned");
		}

		const main = row.createDiv({ cls: "urso-tags-main" });
		this.renderDisclosure(
			main,
			node,
			"Collapse property",
			"Expand property",
			() => {
				this.toggleNode(node, "properties");
			},
		);

		this.renderPropertyIcon(main, node);

		const labelGroup = main.createDiv({ cls: "urso-tags-label-group" });
		labelGroup.createDiv({
			cls: "urso-tags-label",
			text: node.name,
		});

		if (this.plugin.settings.showCounts) {
			row.createDiv({
				cls: "urso-tags-count",
				text: String(node.noteCount),
			});
		}

		row.addEventListener("click", () => {
			this.selectedPropertyKey = node.key;
			if (this.usesSinglePaneLayout()) {
				this.mobilePane = "notes";
			}
			this.render();
		});

		row.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.openPropertyContextMenu(event, node);
		});

		if (this.isExpanded(node)) {
			for (const child of this.getOrderedPropertyNodes(node.children)) {
				this.renderPropertyNode(container, child, depth + 1);
			}
		}
	}

	private renderDisclosure(
		container: HTMLElement,
		node: TreeNodeLike,
		collapseLabel: string,
		expandLabel: string,
		onToggle: () => void,
	): void {
		const disclosure = container.createEl("button", {
			cls: ["clickable-icon", "urso-tags-disclosure"],
			attr: {
				type: "button",
			},
		});

		if (!this.isExpandable(node)) {
			disclosure.addClass("is-hidden");
			disclosure.setAttr("aria-hidden", "true");
			disclosure.tabIndex = -1;
			return;
		}

		const isExpanded = this.isExpanded(node);
		setIcon(disclosure, isExpanded ? "chevron-down" : "chevron-right");
		setTooltip(disclosure, isExpanded ? collapseLabel : expandLabel);
		disclosure.setAttr(
			"aria-label",
			isExpanded ? collapseLabel : expandLabel,
		);

		disclosure.addEventListener("click", (event) => {
			event.stopPropagation();
			onToggle();
		});
	}

	private renderTagIcon(container: HTMLElement, node: TagNode): void {
		const iconName = this.plugin.getTagIcon(node.key);
		const iconEl = container.createDiv({
			cls: ["urso-tags-icon", iconName ? "" : "is-empty"],
		});

		if (!iconName) {
			iconEl.setAttr("aria-hidden", "true");
			return;
		}

		setIcon(iconEl, iconName);
	}

	private renderPropertyIcon(container: HTMLElement, node: PropertyNode): void {
		const iconName = this.plugin.getPropertyIcon(node.key);
		const iconEl = container.createDiv({
			cls: ["urso-tags-icon", iconName ? "" : "is-empty"],
		});

		if (!iconName) {
			iconEl.setAttr("aria-hidden", "true");
			return;
		}

		setIcon(iconEl, iconName);
	}

	private renderNotesPanel(
		container: HTMLElement,
		visibleTagTree: TagNode[],
		options?: { showBackButton?: boolean },
	): void {
		const header = container.createDiv({ cls: "urso-notes-header" });
		const headerMain = header.createDiv({ cls: "urso-pane-header-main" });

		if (options?.showBackButton) {
			const backButton = headerMain.createEl("button", {
				cls: [
					"clickable-icon",
					"urso-tags-header-button",
					"urso-pane-back-button",
				],
				attr: {
					type: "button",
				},
			});
			setIcon(backButton, "arrow-left");
			setTooltip(
				backButton,
				this.primaryMode === "tags"
					? "Back to tags"
					: "Back to properties",
			);
			backButton.setAttr(
				"aria-label",
				this.primaryMode === "tags"
					? "Back to tags"
					: "Back to properties",
			);
			backButton.addEventListener("click", () => {
				this.mobilePane = "main";
				this.render();
			});
		}

		headerMain.createDiv({
			cls: "urso-tags-header-title",
			text: this.getNotesHeaderTitle(visibleTagTree),
		});

		const actions = header.createDiv({ cls: "urso-tags-header-actions" });
		const createButton = actions.createEl("button", {
			cls: ["clickable-icon", "urso-tags-header-button"],
			attr: {
				type: "button",
			},
		});
		const createContext = this.getSelectedCreateContext();
		const canCreateNote = Boolean(createContext);
		const createLabel = canCreateNote
			? "Create note"
			: this.primaryMode === "tags"
				? "Select a tag first"
				: "Select a property first";
		setIcon(createButton, "plus");
		setTooltip(createButton, createLabel);
		createButton.setAttr("aria-label", createLabel);
		createButton.disabled = !canCreateNote;
		if (canCreateNote) {
			createButton.addEventListener("click", () => {
				void this.plugin.createNoteInSelectedContext();
			});
		}

		if (this.primaryMode === "properties") {
			this.renderPropertyNotesPanel(container);
			return;
		}

		this.renderTagNotesPanel(container, visibleTagTree);
	}

	private renderTagNotesPanel(
		container: HTMLElement,
		visibleTagTree: TagNode[],
	): void {
		const selectedNode = this.selectedTagKey
			? this.findNodeByKey(visibleTagTree, this.selectedTagKey)
			: null;

		if (visibleTagTree.length === 0) {
			this.renderEmptyState(
				container,
				"Nothing to show yet.",
				"Tagged notes will appear here.",
			);
			return;
		}

		if (!selectedNode || !this.selectedTagKey) {
			this.renderEmptyState(
				container,
				"Select a tag.",
				"Choose a tag in the left pane to browse matching notes.",
			);
			return;
		}

		const files = this.getOrderedFilesForTag(this.selectedTagKey);
		if (files.length === 0) {
			this.renderEmptyState(
				container,
				"No notes in this tag.",
				"This tag exists, but it does not currently match any notes.",
			);
			return;
		}

		const list = container.createDiv({ cls: "urso-notes-list" });
		for (const file of files) {
			this.renderFileRow(list, file, this.selectedTagKey);
		}
	}

	private renderPropertyNotesPanel(container: HTMLElement): void {
		if (this.plugin.settings.trackedProperties.length === 0) {
			this.renderEmptyState(container, "Select a property.", "Choose a property in the left pane to browse matching notes.");
			return;
		}

		const selectedNode = this.selectedPropertyKey
			? this.findNodeByKey(
					this.plugin.index.propertyTree,
					this.selectedPropertyKey,
				)
			: null;
		if (!selectedNode || !this.selectedPropertyKey) {
			this.renderEmptyState(
				container,
				"Select a property.",
				"Choose a property in the left pane to browse matching notes.",
			);
			return;
		}

		const files = this.getOrderedFilesForProperty(this.selectedPropertyKey);
		if (files.length === 0) {
			this.renderEmptyState(
				container,
				"No notes with this property.",
				"This property is being tracked, but it does not currently match any notes.",
			);
			return;
		}

		const list = container.createDiv({ cls: "urso-notes-list" });
		for (const file of files) {
			this.renderFileRow(list, file, null);
		}
	}

	private renderFileRow(
		container: HTMLElement,
		file: TFile,
		tagKey: string | null,
	): void {
		const row = container.createDiv({ cls: "urso-note-row" });
		if (tagKey && this.plugin.isNotePinned(tagKey, file.path)) {
			row.addClass("is-pinned");
		}

		const main = row.createDiv({ cls: "urso-note-main" });
		this.renderNoteIcon(main, file);
		const textGroup = main.createDiv({ cls: "urso-note-text" });
		textGroup.createDiv({ cls: "urso-note-title", text: file.basename });
		const secondaryLine = this.plugin.getNoteSecondaryLine(file);
		if (secondaryLine) {
			textGroup.createDiv({
				cls: "urso-note-secondary",
				text: secondaryLine,
			});
		}

		row.addEventListener("click", () => {
			void this.openFile(file);
		});

		row.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.openNoteContextMenu(event, tagKey, file);
		});
	}

	private renderNoteIcon(container: HTMLElement, file: TFile): void {
		const iconName = this.plugin.getNoteIcon(file.path);
		const iconEl = container.createDiv({
			cls: ["urso-note-icon", iconName ? "" : "is-empty"],
		});

		if (!iconName) {
			iconEl.setAttr("aria-hidden", "true");
			return;
		}

		setIcon(iconEl, iconName);
	}

	private renderEmptyState(
		container: HTMLElement,
		title: string,
		description: string,
	): void {
		const state = container.createDiv({ cls: "urso-empty-state" });
		state.createDiv({ cls: "urso-empty-title", text: title });
		state.createDiv({ cls: "urso-empty-description", text: description });
	}

	private toggleNode<T extends TreeNodeLike>(
		node: T,
		mode: PrimaryViewMode,
	): void {
		if (!this.isExpandable(node)) {
			return;
		}

		if (this.collapsedNodeKeys.has(node.key)) {
			this.collapsedNodeKeys.delete(node.key);
		} else {
			this.collapsedNodeKeys.add(node.key);

			const selectedKey = this.getSelectedKeyForMode(mode);
			if (
				selectedKey &&
				selectedKey !== node.key &&
				this.containsNodeKey(node, selectedKey)
			) {
				this.setSelectedKeyForMode(mode, node.key);
			}
		}

		this.render();
	}

	private toggleAllBranches(): void {
		if (this.primaryMode === "tags") {
			this.toggleAllBranchesForNodes(this.getVisibleTagTree(), "tags");
			return;
		}

		this.toggleAllBranchesForNodes(
			this.plugin.index.propertyTree,
			"properties",
		);
	}

	private toggleAllBranchesForNodes<T extends TreeNodeLike>(
		nodes: T[],
		mode: PrimaryViewMode,
	): void {
		const expandableKeys = this.getExpandableNodeKeys(nodes);
		if (expandableKeys.size === 0) {
			return;
		}

		if (this.hasCollapsedBranches(expandableKeys)) {
			this.collapsedNodeKeys.clear();
		} else {
			this.collapsedNodeKeys.clear();
			for (const key of expandableKeys) {
				this.collapsedNodeKeys.add(key);
			}

			const selectedKey = this.getSelectedKeyForMode(mode);
			if (selectedKey) {
				const visibleAncestor = this.findTopLevelAncestorForKey(
					nodes,
					selectedKey,
				);
				if (visibleAncestor) {
					this.setSelectedKeyForMode(mode, visibleAncestor.key);
					this.collapsedNodeKeys.delete(visibleAncestor.key);
				}
			}
		}

		this.render();
	}

	private openPrimaryModeMenu(event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle("Tags");
			if (this.primaryMode === "tags") {
				item.setIcon("check");
			}
			item.onClick(() => {
				this.switchPrimaryMode("tags");
			});
		});
		menu.addItem((item) => {
			item.setTitle("Properties");
			if (this.primaryMode === "properties") {
				item.setIcon("check");
			}
			item.onClick(() => {
				this.switchPrimaryMode("properties");
			});
		});
		menu.showAtMouseEvent(event);
	}

	private switchPrimaryMode(mode: PrimaryViewMode): void {
		if (this.primaryMode === mode) {
			return;
		}

		this.primaryMode = mode;
		void this.plugin.setPrimaryViewMode(mode);
		this.mobilePane = "main";
		this.render();
	}

	private getOrderedTagNodes(nodes: TagNode[]): TagNode[] {
		if (nodes.length <= 1) {
			return nodes;
		}

		const firstNode = nodes[0];
		const lastNode = nodes[nodes.length - 1];
		const orderedRegularNodes = this.partitionPinnedItems(
			nodes.filter((node) => !node.isSpecial),
			(node) => this.plugin.isTagPinned(node.key),
		);

		if (firstNode?.isSpecial) {
			return [firstNode, ...orderedRegularNodes];
		}

		if (lastNode?.isSpecial) {
			return [...orderedRegularNodes, lastNode];
		}

		return orderedRegularNodes;
	}

	private getOrderedPropertyNodes(nodes: PropertyNode[]): PropertyNode[] {
		if (nodes.length <= 1) {
			return nodes;
		}

		return this.partitionPinnedItems(nodes, (node) =>
			this.plugin.isPropertyPinned(node.key),
		);
	}

	private getOrderedFilesForTag(tagKey: string): TFile[] {
		const files = this.plugin.index.notesByTag.get(tagKey) ?? [];
		return this.partitionPinnedItems(
			files,
			(file) => this.plugin.isNotePinned(tagKey, file.path),
			(left, right) => this.compareFiles(left, right),
		);
	}

	private getOrderedFilesForProperty(propertyNodeKey: string): TFile[] {
		const files =
			this.plugin.index.notesByProperty.get(propertyNodeKey) ?? [];
		return [...files].sort((left, right) => this.compareFiles(left, right));
	}

	private getNotesHeaderTitle(visibleTagTree: TagNode[]): string {
		if (this.primaryMode === "tags") {
			const selectedNode = this.selectedTagKey
				? this.findNodeByKey(visibleTagTree, this.selectedTagKey)
				: null;
			return selectedNode ? selectedNode.name : "Notes";
		}

		const selectedNode = this.selectedPropertyKey
			? this.findNodeByKey(
					this.plugin.index.propertyTree,
					this.selectedPropertyKey,
				)
			: null;
		if (!selectedNode) {
			return "Notes";
		}

		return selectedNode.propertyValue
			? `${selectedNode.propertyKey}: ${selectedNode.propertyValue}`
			: selectedNode.name;
	}

	private getSelectedKeyForMode(mode: PrimaryViewMode): string | null {
		return mode === "tags" ? this.selectedTagKey : this.selectedPropertyKey;
	}

	private setSelectedKeyForMode(mode: PrimaryViewMode, key: string | null): void {
		if (mode === "tags") {
			this.selectedTagKey = key;
			return;
		}

		this.selectedPropertyKey = key;
	}

	private findNodeByKey<T extends TreeNodeLike>(
		nodes: T[],
		key: string,
	): T | null {
		for (const node of nodes) {
			if (node.key === key) {
				return node;
			}

			const childMatch = this.findNodeByKey(node.children as T[], key);
			if (childMatch) {
				return childMatch;
			}
		}

		return null;
	}

	private containsNodeKey<T extends TreeNodeLike>(
		node: T,
		key: string,
	): boolean {
		if (node.key === key) {
			return true;
		}

		for (const child of node.children) {
			if (this.containsNodeKey(child as T, key)) {
				return true;
			}
		}

		return false;
	}

	private findTopLevelAncestorForKey<T extends TreeNodeLike>(
		nodes: T[],
		key: string,
	): T | null {
		for (const node of nodes) {
			if (this.containsNodeKey(node, key)) {
				return node;
			}
		}

		return null;
	}

	private getExpandableNodeKeys<T extends TreeNodeLike>(
		nodes: T[],
		keys: Set<string> = new Set<string>(),
	): Set<string> {
		for (const node of nodes) {
			if (this.isExpandable(node)) {
				keys.add(node.key);
				this.getExpandableNodeKeys(node.children as T[], keys);
			}
		}

		return keys;
	}

	private hasCollapsedBranches(expandableKeys: Set<string>): boolean {
		for (const key of expandableKeys) {
			if (this.collapsedNodeKeys.has(key)) {
				return true;
			}
		}

		return false;
	}

	private isExpandable(node: TreeNodeLike): boolean {
		return node.children.length > 0;
	}

	private isExpanded(node: TreeNodeLike): boolean {
		return !this.collapsedNodeKeys.has(node.key);
	}

	private pruneCollapsedState(
		tagNodes: TagNode[],
		propertyNodes: PropertyNode[],
	): void {
		const expandableKeys = this.getExpandableNodeKeys(
			tagNodes,
			this.getExpandableNodeKeys(propertyNodes),
		);
		for (const key of Array.from(this.collapsedNodeKeys)) {
			if (!expandableKeys.has(key)) {
				this.collapsedNodeKeys.delete(key);
			}
		}
	}

	private getVisibleTagTree(): TagNode[] {
		if (this.plugin.settings.hiddenTags.length === 0) {
			return this.plugin.index.tagTree;
		}

		const hiddenTags = new Set(this.plugin.settings.hiddenTags);
		return this.filterHiddenNodes(this.plugin.index.tagTree, hiddenTags);
	}

	private filterHiddenNodes(
		nodes: TagNode[],
		hiddenTags: Set<string>,
	): TagNode[] {
		const visibleNodes: TagNode[] = [];
		for (const node of nodes) {
			if (hiddenTags.has(node.key)) {
				continue;
			}

			visibleNodes.push({
				...node,
				children: this.filterHiddenNodes(node.children, hiddenTags),
			});
		}

		return visibleNodes;
	}

	private usesSinglePaneLayout(): boolean {
		return (
			Platform.isPhone ||
			(Platform.isTablet && this.plugin.settings.useMobileLayoutOnTablet)
		);
	}

	private setupSplitResizer(root: HTMLElement, handle: HTMLElement): void {
		handle.setAttr("aria-label", "Resize panes");
		handle.addEventListener("pointerdown", (event: PointerEvent) => {
			if (event.button !== 0) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			let nextRatio = this.applySplitRatio(
				root,
				this.plugin.settings.splitPaneRatio,
			);
			root.addClass("is-resizing");

			const updateRatio = (pointerEvent: PointerEvent): void => {
				const rect = root.getBoundingClientRect();
				if (rect.width <= 0) {
					return;
				}

				nextRatio = this.applySplitRatio(
					root,
					(pointerEvent.clientX - rect.left) / rect.width,
				);
			};

			const finishResize = (): void => {
				root.removeClass("is-resizing");
				window.removeEventListener("pointermove", updateRatio);
				window.removeEventListener("pointerup", finishResize);
				window.removeEventListener("pointercancel", finishResize);

				if (nextRatio !== this.plugin.settings.splitPaneRatio) {
					this.plugin.settings.splitPaneRatio = nextRatio;
					void this.plugin.saveSettings();
				}
			};

			window.addEventListener("pointermove", updateRatio);
			window.addEventListener("pointerup", finishResize);
			window.addEventListener("pointercancel", finishResize);
		});
	}

	private applySplitRatio(root: HTMLElement, ratio: number): number {
		const clampedRatio = this.clampSplitRatio(root, ratio);
		root.style.setProperty(
			"--urso-left-pane-size",
			`${clampedRatio * 100}%`,
		);
		return clampedRatio;
	}

	private clampSplitRatio(root: HTMLElement, ratio: number): number {
		const width = root.getBoundingClientRect().width;
		if (width <= 0) {
			return Math.min(0.75, Math.max(0.25, ratio));
		}

		const minPaneWidth = Math.min(180, width * 0.35);
		const minRatio = Math.min(0.45, minPaneWidth / width);
		return Math.min(1 - minRatio, Math.max(minRatio, ratio));
	}

	private async openFile(file: TFile): Promise<void> {
		const recentLeaf = this.app.workspace.getMostRecentLeaf();
		const targetLeaf =
			recentLeaf &&
			recentLeaf !== this.leaf &&
			recentLeaf.getViewState().type !== VIEW_TYPE_URSO
				? recentLeaf
				: this.app.workspace.getLeaf("tab");

		await targetLeaf.openFile(file);
	}

	private openTagContextMenu(event: MouseEvent, node: TagNode): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(
				this.plugin.isTagPinned(node.key) ? "Unpin tag" : "Pin tag",
			)
				.setIcon("pin")
				.onClick(() => {
					void this.plugin.toggleTagPin(node.key);
				});
		});
		menu.addItem((item) => {
			item.setTitle("Set icon")
				.setIcon("image")
				.onClick(() => {
					this.openTagIconPicker(node);
				});
		});
		if (!node.isSpecial) {
			menu.addItem((item) => {
				item.setTitle("Hide tag")
					.setIcon("eye-off")
					.onClick(() => {
						void this.plugin.hideTag(node.key);
					});
			});
		}
		menu.showAtMouseEvent(event);
	}

	private openPropertyContextMenu(
		event: MouseEvent,
		node: PropertyNode,
	): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(
				this.plugin.isPropertyPinned(node.key)
					? "Unpin property"
					: "Pin property",
			)
				.setIcon("pin")
				.onClick(() => {
					void this.plugin.togglePropertyPin(node.key);
				});
		});
		menu.addItem((item) => {
			item.setTitle("Set icon")
				.setIcon("image")
				.onClick(() => {
					this.openPropertyIconPicker(node);
				});
		});
		menu.showAtMouseEvent(event);
	}

	private openNoteContextMenu(
		event: MouseEvent,
		tagKey: string | null,
		file: TFile,
	): void {
		const menu = new Menu();
		if (tagKey) {
			menu.addItem((item) => {
				item.setTitle(
					this.plugin.isNotePinned(tagKey, file.path)
						? "Unpin note"
						: "Pin note",
				)
					.setIcon("pin")
					.onClick(() => {
						void this.plugin.toggleNotePin(tagKey, file.path);
					});
			});
		}
		menu.addItem((item) => {
			item.setTitle("Set icon")
				.setIcon("image")
				.onClick(() => {
					this.openNoteIconPicker(file);
				});
		});
		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle("Delete note")
				.setIcon("trash-2")
				.setWarning(true)
				.onClick(() => {
					void this.plugin.deleteNote(file);
				});
		});
		menu.showAtMouseEvent(event);
	}

	private openTagIconPicker(node: TagNode): void {
		const modal = new TagIconPickerModal(this.app, {
			tagLabel: node.name,
			currentIcon: this.plugin.getTagIcon(node.key),
			onChoose: async (iconName) => {
				await this.plugin.setTagIcon(node.key, iconName);
			},
		});

		modal.open();
	}

	private openPropertyIconPicker(node: PropertyNode): void {
		const label = node.propertyValue
			? `${node.propertyKey}: ${node.propertyValue}`
			: node.name;
		const modal = new TagIconPickerModal(this.app, {
			tagLabel: label,
			currentIcon: this.plugin.getPropertyIcon(node.key),
			onChoose: async (iconName) => {
				await this.plugin.setPropertyIcon(node.key, iconName);
			},
		});

		modal.open();
	}

	private openNoteIconPicker(file: TFile): void {
		const modal = new TagIconPickerModal(this.app, {
			tagLabel: file.basename,
			currentIcon: this.plugin.getNoteIcon(file.path),
			onChoose: async (iconName) => {
				await this.plugin.setNoteIcon(file.path, iconName);
			},
		});

		modal.open();
	}

	private compareFiles(left: TFile, right: TFile): number {
		switch (this.plugin.settings.notesSortOrder) {
			case "updated-desc":
				return this.compareNumbers(
					right.stat.mtime,
					left.stat.mtime,
					left,
					right,
				);
			case "updated-asc":
				return this.compareNumbers(
					left.stat.mtime,
					right.stat.mtime,
					left,
					right,
				);
			case "created-desc":
				return this.compareNumbers(
					right.stat.ctime,
					left.stat.ctime,
					left,
					right,
				);
			case "created-asc":
				return this.compareNumbers(
					left.stat.ctime,
					right.stat.ctime,
					left,
					right,
				);
			case "title-asc":
				return this.compareFileNames(left, right);
		}
	}

	private compareNumbers(
		left: number,
		right: number,
		leftFile: TFile,
		rightFile: TFile,
	): number {
		if (left === right) {
			return this.compareFileNames(leftFile, rightFile);
		}

		return left - right;
	}

	private compareFileNames(left: TFile, right: TFile): number {
		const nameComparison = left.basename.localeCompare(
			right.basename,
			undefined,
			{ sensitivity: "base" },
		);
		if (nameComparison !== 0) {
			return nameComparison;
		}

		return left.path.localeCompare(right.path, undefined, {
			sensitivity: "base",
		});
	}

	private partitionPinnedItems<T>(
		items: T[],
		isPinned: (item: T) => boolean,
		compare?: (left: T, right: T) => number,
	): T[] {
		const pinnedItems: T[] = [];
		const unpinnedItems: T[] = [];

		for (const item of items) {
			if (isPinned(item)) {
				pinnedItems.push(item);
			} else {
				unpinnedItems.push(item);
			}
		}

		if (compare) {
			pinnedItems.sort(compare);
			unpinnedItems.sort(compare);
		}

		return [...pinnedItems, ...unpinnedItems];
	}
}
