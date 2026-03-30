import { __awaiter } from "tslib";
import { ItemView, Menu, Platform, Scope, setIcon, setTooltip, } from "obsidian";
import { TagIconPickerModal } from "../tag-icon-picker-modal";
import { UNTAGGED_KEY, VIEW_TYPE_URSO, } from "../models";
export class UrsoView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.primaryMode = "tags";
        this.selectedPropertyKey = null;
        this.selectedTagKey = null;
        this.collapsedNodeKeys = new Set();
        this.mobilePane = "main";
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
    getViewType() {
        return VIEW_TYPE_URSO;
    }
    getDisplayText() {
        return "Urso";
    }
    getIcon() {
        return "library";
    }
    getSelectedTagKey() {
        return this.primaryMode === "tags" ? this.selectedTagKey : null;
    }
    getSelectedCreateContext() {
        var _a;
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
        const selectedNode = this.findNodeByKey(this.plugin.index.propertyTree, this.selectedPropertyKey);
        if (!selectedNode) {
            return null;
        }
        return {
            type: "property",
            propertyKey: selectedNode.propertyKey,
            propertyValue: (_a = selectedNode.propertyValue) !== null && _a !== void 0 ? _a : null,
        };
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            this.render();
        });
    }
    onClose() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    refresh() {
        const visibleTagTree = this.getVisibleTagTree();
        const propertyTree = this.plugin.index.propertyTree;
        if (this.selectedTagKey &&
            !this.findNodeByKey(visibleTagTree, this.selectedTagKey)) {
            this.selectedTagKey = null;
        }
        if (this.selectedPropertyKey &&
            !this.findNodeByKey(propertyTree, this.selectedPropertyKey)) {
            this.selectedPropertyKey = null;
        }
        if (!this.getSelectedKeyForMode(this.primaryMode)) {
            this.mobilePane = "main";
        }
        this.pruneCollapsedState(visibleTagTree, propertyTree);
        this.render();
    }
    render() {
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
            if (this.mobilePane === "notes" &&
                this.getSelectedKeyForMode(this.primaryMode)) {
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
    renderPrimaryPanel(container, visibleTagTree) {
        if (this.primaryMode === "properties") {
            this.renderPropertyTree(container, this.plugin.index.propertyTree);
            return;
        }
        this.renderTagTree(container, visibleTagTree);
    }
    renderTagTree(container, nodes) {
        this.renderPrimaryHeader(container, "Tags", nodes);
        if (nodes.length === 0) {
            this.renderEmptyState(container, "No tags found yet.", "Add tags to notes to populate this view.");
            return;
        }
        const tree = container.createDiv({ cls: "urso-tags-tree" });
        for (const node of this.getOrderedTagNodes(nodes)) {
            this.renderTagNode(tree, node, 0);
        }
    }
    renderPropertyTree(container, nodes) {
        this.renderPrimaryHeader(container, "Properties", nodes);
        if (this.plugin.settings.trackedProperties.length === 0) {
            this.renderEmptyState(container, "No properties configured.", "Manage tracked properties in Urso settings to populate this view.");
            return;
        }
        const tree = container.createDiv({ cls: "urso-tags-tree" });
        for (const node of this.getOrderedPropertyNodes(nodes)) {
            this.renderPropertyNode(tree, node, 0);
        }
    }
    renderPrimaryHeader(container, title, nodes) {
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
        switchButton.setAttr("aria-label", "Switch between tags and properties");
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
    renderTagNode(container, node, depth) {
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
    renderPropertyNode(container, node, depth) {
        const row = container.createDiv({ cls: "urso-tags-row" });
        row.style.paddingLeft = `${depth * 16 + 12}px`;
        if (this.selectedPropertyKey === node.key) {
            row.addClass("is-selected");
        }
        if (this.plugin.isPropertyPinned(node.key)) {
            row.addClass("is-pinned");
        }
        const main = row.createDiv({ cls: "urso-tags-main" });
        this.renderDisclosure(main, node, "Collapse property", "Expand property", () => {
            this.toggleNode(node, "properties");
        });
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
    renderDisclosure(container, node, collapseLabel, expandLabel, onToggle) {
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
        disclosure.setAttr("aria-label", isExpanded ? collapseLabel : expandLabel);
        disclosure.addEventListener("click", (event) => {
            event.stopPropagation();
            onToggle();
        });
    }
    renderTagIcon(container, node) {
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
    renderPropertyIcon(container, node) {
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
    renderNotesPanel(container, visibleTagTree, options) {
        const header = container.createDiv({ cls: "urso-notes-header" });
        const headerMain = header.createDiv({ cls: "urso-pane-header-main" });
        if (options === null || options === void 0 ? void 0 : options.showBackButton) {
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
            setTooltip(backButton, this.primaryMode === "tags"
                ? "Back to tags"
                : "Back to properties");
            backButton.setAttr("aria-label", this.primaryMode === "tags"
                ? "Back to tags"
                : "Back to properties");
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
    renderTagNotesPanel(container, visibleTagTree) {
        const selectedNode = this.selectedTagKey
            ? this.findNodeByKey(visibleTagTree, this.selectedTagKey)
            : null;
        if (visibleTagTree.length === 0) {
            this.renderEmptyState(container, "Nothing to show yet.", "Tagged notes will appear here.");
            return;
        }
        if (!selectedNode || !this.selectedTagKey) {
            this.renderEmptyState(container, "Select a tag.", "Choose a tag in the left pane to browse matching notes.");
            return;
        }
        const files = this.getOrderedFilesForTag(this.selectedTagKey);
        if (files.length === 0) {
            this.renderEmptyState(container, "No notes in this tag.", "This tag exists, but it does not currently match any notes.");
            return;
        }
        const list = container.createDiv({ cls: "urso-notes-list" });
        for (const file of files) {
            this.renderFileRow(list, file, this.selectedTagKey);
        }
    }
    renderPropertyNotesPanel(container) {
        if (this.plugin.settings.trackedProperties.length === 0) {
            this.renderEmptyState(container, "Select a property.", "Choose a property in the left pane to browse matching notes.");
            return;
        }
        const selectedNode = this.selectedPropertyKey
            ? this.findNodeByKey(this.plugin.index.propertyTree, this.selectedPropertyKey)
            : null;
        if (!selectedNode || !this.selectedPropertyKey) {
            this.renderEmptyState(container, "Select a property.", "Choose a property in the left pane to browse matching notes.");
            return;
        }
        const files = this.getOrderedFilesForProperty(this.selectedPropertyKey);
        if (files.length === 0) {
            this.renderEmptyState(container, "No notes with this property.", "This property is being tracked, but it does not currently match any notes.");
            return;
        }
        const list = container.createDiv({ cls: "urso-notes-list" });
        for (const file of files) {
            this.renderFileRow(list, file, null);
        }
    }
    renderFileRow(container, file, tagKey) {
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
    renderNoteIcon(container, file) {
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
    renderEmptyState(container, title, description) {
        const state = container.createDiv({ cls: "urso-empty-state" });
        state.createDiv({ cls: "urso-empty-title", text: title });
        state.createDiv({ cls: "urso-empty-description", text: description });
    }
    toggleNode(node, mode) {
        if (!this.isExpandable(node)) {
            return;
        }
        if (this.collapsedNodeKeys.has(node.key)) {
            this.collapsedNodeKeys.delete(node.key);
        }
        else {
            this.collapsedNodeKeys.add(node.key);
            const selectedKey = this.getSelectedKeyForMode(mode);
            if (selectedKey &&
                selectedKey !== node.key &&
                this.containsNodeKey(node, selectedKey)) {
                this.setSelectedKeyForMode(mode, node.key);
            }
        }
        this.render();
    }
    toggleAllBranches() {
        if (this.primaryMode === "tags") {
            this.toggleAllBranchesForNodes(this.getVisibleTagTree(), "tags");
            return;
        }
        this.toggleAllBranchesForNodes(this.plugin.index.propertyTree, "properties");
    }
    toggleAllBranchesForNodes(nodes, mode) {
        const expandableKeys = this.getExpandableNodeKeys(nodes);
        if (expandableKeys.size === 0) {
            return;
        }
        if (this.hasCollapsedBranches(expandableKeys)) {
            this.collapsedNodeKeys.clear();
        }
        else {
            this.collapsedNodeKeys.clear();
            for (const key of expandableKeys) {
                this.collapsedNodeKeys.add(key);
            }
            const selectedKey = this.getSelectedKeyForMode(mode);
            if (selectedKey) {
                const visibleAncestor = this.findTopLevelAncestorForKey(nodes, selectedKey);
                if (visibleAncestor) {
                    this.setSelectedKeyForMode(mode, visibleAncestor.key);
                    this.collapsedNodeKeys.delete(visibleAncestor.key);
                }
            }
        }
        this.render();
    }
    openPrimaryModeMenu(event) {
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
    switchPrimaryMode(mode) {
        if (this.primaryMode === mode) {
            return;
        }
        this.primaryMode = mode;
        void this.plugin.setPrimaryViewMode(mode);
        this.mobilePane = "main";
        this.render();
    }
    getOrderedTagNodes(nodes) {
        if (nodes.length <= 1) {
            return nodes;
        }
        const firstNode = nodes[0];
        const lastNode = nodes[nodes.length - 1];
        const orderedRegularNodes = this.partitionPinnedItems(nodes.filter((node) => !node.isSpecial), (node) => this.plugin.isTagPinned(node.key));
        if (firstNode === null || firstNode === void 0 ? void 0 : firstNode.isSpecial) {
            return [firstNode, ...orderedRegularNodes];
        }
        if (lastNode === null || lastNode === void 0 ? void 0 : lastNode.isSpecial) {
            return [...orderedRegularNodes, lastNode];
        }
        return orderedRegularNodes;
    }
    getOrderedPropertyNodes(nodes) {
        if (nodes.length <= 1) {
            return nodes;
        }
        return this.partitionPinnedItems(nodes, (node) => this.plugin.isPropertyPinned(node.key));
    }
    getOrderedFilesForTag(tagKey) {
        var _a;
        const files = (_a = this.plugin.index.notesByTag.get(tagKey)) !== null && _a !== void 0 ? _a : [];
        return this.partitionPinnedItems(files, (file) => this.plugin.isNotePinned(tagKey, file.path), (left, right) => this.compareFiles(left, right));
    }
    getOrderedFilesForProperty(propertyNodeKey) {
        var _a;
        const files = (_a = this.plugin.index.notesByProperty.get(propertyNodeKey)) !== null && _a !== void 0 ? _a : [];
        return [...files].sort((left, right) => this.compareFiles(left, right));
    }
    getNotesHeaderTitle(visibleTagTree) {
        if (this.primaryMode === "tags") {
            const selectedNode = this.selectedTagKey
                ? this.findNodeByKey(visibleTagTree, this.selectedTagKey)
                : null;
            return selectedNode ? selectedNode.name : "Notes";
        }
        const selectedNode = this.selectedPropertyKey
            ? this.findNodeByKey(this.plugin.index.propertyTree, this.selectedPropertyKey)
            : null;
        if (!selectedNode) {
            return "Notes";
        }
        return selectedNode.propertyValue
            ? `${selectedNode.propertyKey}: ${selectedNode.propertyValue}`
            : selectedNode.name;
    }
    getSelectedKeyForMode(mode) {
        return mode === "tags" ? this.selectedTagKey : this.selectedPropertyKey;
    }
    setSelectedKeyForMode(mode, key) {
        if (mode === "tags") {
            this.selectedTagKey = key;
            return;
        }
        this.selectedPropertyKey = key;
    }
    findNodeByKey(nodes, key) {
        for (const node of nodes) {
            if (node.key === key) {
                return node;
            }
            const childMatch = this.findNodeByKey(node.children, key);
            if (childMatch) {
                return childMatch;
            }
        }
        return null;
    }
    containsNodeKey(node, key) {
        if (node.key === key) {
            return true;
        }
        for (const child of node.children) {
            if (this.containsNodeKey(child, key)) {
                return true;
            }
        }
        return false;
    }
    findTopLevelAncestorForKey(nodes, key) {
        for (const node of nodes) {
            if (this.containsNodeKey(node, key)) {
                return node;
            }
        }
        return null;
    }
    getExpandableNodeKeys(nodes, keys = new Set()) {
        for (const node of nodes) {
            if (this.isExpandable(node)) {
                keys.add(node.key);
                this.getExpandableNodeKeys(node.children, keys);
            }
        }
        return keys;
    }
    hasCollapsedBranches(expandableKeys) {
        for (const key of expandableKeys) {
            if (this.collapsedNodeKeys.has(key)) {
                return true;
            }
        }
        return false;
    }
    isExpandable(node) {
        return node.children.length > 0;
    }
    isExpanded(node) {
        return !this.collapsedNodeKeys.has(node.key);
    }
    pruneCollapsedState(tagNodes, propertyNodes) {
        const expandableKeys = this.getExpandableNodeKeys(tagNodes, this.getExpandableNodeKeys(propertyNodes));
        for (const key of Array.from(this.collapsedNodeKeys)) {
            if (!expandableKeys.has(key)) {
                this.collapsedNodeKeys.delete(key);
            }
        }
    }
    getVisibleTagTree() {
        if (this.plugin.settings.hiddenTags.length === 0) {
            return this.plugin.index.tagTree;
        }
        const hiddenTags = new Set(this.plugin.settings.hiddenTags);
        return this.filterHiddenNodes(this.plugin.index.tagTree, hiddenTags);
    }
    filterHiddenNodes(nodes, hiddenTags) {
        const visibleNodes = [];
        for (const node of nodes) {
            if (hiddenTags.has(node.key)) {
                continue;
            }
            visibleNodes.push(Object.assign(Object.assign({}, node), { children: this.filterHiddenNodes(node.children, hiddenTags) }));
        }
        return visibleNodes;
    }
    usesSinglePaneLayout() {
        return (Platform.isPhone ||
            (Platform.isTablet && this.plugin.settings.useMobileLayoutOnTablet));
    }
    setupSplitResizer(root, handle) {
        handle.setAttr("aria-label", "Resize panes");
        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            let nextRatio = this.applySplitRatio(root, this.plugin.settings.splitPaneRatio);
            root.addClass("is-resizing");
            const updateRatio = (pointerEvent) => {
                const rect = root.getBoundingClientRect();
                if (rect.width <= 0) {
                    return;
                }
                nextRatio = this.applySplitRatio(root, (pointerEvent.clientX - rect.left) / rect.width);
            };
            const finishResize = () => {
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
    applySplitRatio(root, ratio) {
        const clampedRatio = this.clampSplitRatio(root, ratio);
        root.style.setProperty("--urso-left-pane-size", `${clampedRatio * 100}%`);
        return clampedRatio;
    }
    clampSplitRatio(root, ratio) {
        const width = root.getBoundingClientRect().width;
        if (width <= 0) {
            return Math.min(0.75, Math.max(0.25, ratio));
        }
        const minPaneWidth = Math.min(180, width * 0.35);
        const minRatio = Math.min(0.45, minPaneWidth / width);
        return Math.min(1 - minRatio, Math.max(minRatio, ratio));
    }
    openFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const recentLeaf = this.app.workspace.getMostRecentLeaf();
            const targetLeaf = recentLeaf &&
                recentLeaf !== this.leaf &&
                recentLeaf.getViewState().type !== VIEW_TYPE_URSO
                ? recentLeaf
                : this.app.workspace.getLeaf("tab");
            yield targetLeaf.openFile(file);
        });
    }
    openTagContextMenu(event, node) {
        const menu = new Menu();
        menu.addItem((item) => {
            item.setTitle(this.plugin.isTagPinned(node.key) ? "Unpin tag" : "Pin tag")
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
    openPropertyContextMenu(event, node) {
        const menu = new Menu();
        menu.addItem((item) => {
            item.setTitle(this.plugin.isPropertyPinned(node.key)
                ? "Unpin property"
                : "Pin property")
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
    openNoteContextMenu(event, tagKey, file) {
        const menu = new Menu();
        if (tagKey) {
            menu.addItem((item) => {
                item.setTitle(this.plugin.isNotePinned(tagKey, file.path)
                    ? "Unpin note"
                    : "Pin note")
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
    openTagIconPicker(node) {
        const modal = new TagIconPickerModal(this.app, {
            tagLabel: node.name,
            currentIcon: this.plugin.getTagIcon(node.key),
            onChoose: (iconName) => __awaiter(this, void 0, void 0, function* () {
                yield this.plugin.setTagIcon(node.key, iconName);
            }),
        });
        modal.open();
    }
    openPropertyIconPicker(node) {
        const label = node.propertyValue
            ? `${node.propertyKey}: ${node.propertyValue}`
            : node.name;
        const modal = new TagIconPickerModal(this.app, {
            tagLabel: label,
            currentIcon: this.plugin.getPropertyIcon(node.key),
            onChoose: (iconName) => __awaiter(this, void 0, void 0, function* () {
                yield this.plugin.setPropertyIcon(node.key, iconName);
            }),
        });
        modal.open();
    }
    openNoteIconPicker(file) {
        const modal = new TagIconPickerModal(this.app, {
            tagLabel: file.basename,
            currentIcon: this.plugin.getNoteIcon(file.path),
            onChoose: (iconName) => __awaiter(this, void 0, void 0, function* () {
                yield this.plugin.setNoteIcon(file.path, iconName);
            }),
        });
        modal.open();
    }
    compareFiles(left, right) {
        switch (this.plugin.settings.notesSortOrder) {
            case "updated-desc":
                return this.compareNumbers(right.stat.mtime, left.stat.mtime, left, right);
            case "updated-asc":
                return this.compareNumbers(left.stat.mtime, right.stat.mtime, left, right);
            case "created-desc":
                return this.compareNumbers(right.stat.ctime, left.stat.ctime, left, right);
            case "created-asc":
                return this.compareNumbers(left.stat.ctime, right.stat.ctime, left, right);
            case "title-asc":
                return this.compareFileNames(left, right);
        }
    }
    compareNumbers(left, right, leftFile, rightFile) {
        if (left === right) {
            return this.compareFileNames(leftFile, rightFile);
        }
        return left - right;
    }
    compareFileNames(left, right) {
        const nameComparison = left.basename.localeCompare(right.basename, undefined, { sensitivity: "base" });
        if (nameComparison !== 0) {
            return nameComparison;
        }
        return left.path.localeCompare(right.path, undefined, {
            sensitivity: "base",
        });
    }
    partitionPinnedItems(items, isPinned, compare) {
        const pinnedItems = [];
        const unpinnedItems = [];
        for (const item of items) {
            if (isPinned(item)) {
                pinnedItems.push(item);
            }
            else {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXJzby10YWdzLXZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1cnNvLXRhZ3Mtdmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUNOLFFBQVEsRUFDUixJQUFJLEVBQ0osUUFBUSxFQUNSLEtBQUssRUFDTCxPQUFPLEVBQ1AsVUFBVSxHQUdWLE1BQU0sVUFBVSxDQUFDO0FBRWxCLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzlELE9BQU8sRUFLTixZQUFZLEVBQ1osY0FBYyxHQUNkLE1BQU0sV0FBVyxDQUFDO0FBV25CLE1BQU0sT0FBTyxRQUFTLFNBQVEsUUFBUTtJQU9yQyxZQUNDLElBQW1CLEVBQ0YsTUFBa0I7UUFFbkMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRkssV0FBTSxHQUFOLE1BQU0sQ0FBWTtRQVI1QixnQkFBVyxHQUFvQixNQUFNLENBQUM7UUFDdEMsd0JBQW1CLEdBQWtCLElBQUksQ0FBQztRQUMxQyxtQkFBYyxHQUFrQixJQUFJLENBQUM7UUFDNUIsc0JBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUMvQyxlQUFVLEdBQWUsTUFBTSxDQUFDO1FBT3ZDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQ3BELElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQzNDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN2QixLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDeEIsS0FBSyxJQUFJ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e1xuXHRJdGVtVmlldyxcblx0TWVudSxcblx0UGxhdGZvcm0sXG5cdFNjb3BlLFxuXHRzZXRJY29uLFxuXHRzZXRUb29sdGlwLFxuXHRURmlsZSxcblx0V29ya3NwYWNlTGVhZixcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgVXJzb1BsdWdpbiBmcm9tIFwiLi4vbWFpblwiO1xuaW1wb3J0IHsgVGFnSWNvblBpY2tlck1vZGFsIH0gZnJvbSBcIi4uL3RhZy1pY29uLXBpY2tlci1tb2RhbFwiO1xuaW1wb3J0IHtcblx0Q3JlYXRlTm90ZUNvbnRleHQsXG5cdFByaW1hcnlWaWV3TW9kZSxcblx0UHJvcGVydHlOb2RlLFxuXHRUYWdOb2RlLFxuXHRVTlRBR0dFRF9LRVksXG5cdFZJRVdfVFlQRV9VUlNPLFxufSBmcm9tIFwiLi4vbW9kZWxzXCI7XG5cbnR5cGUgTW9iaWxlUGFuZSA9IFwibWFpblwiIHwgXCJub3Rlc1wiO1xuXG5pbnRlcmZhY2UgVHJlZU5vZGVMaWtlIHtcblx0a2V5OiBzdHJpbmc7XG5cdG5hbWU6IHN0cmluZztcblx0Y2hpbGRyZW46IFRyZWVOb2RlTGlrZVtdO1xuXHRub3RlQ291bnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFVyc29WaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuXHRwcml2YXRlIHByaW1hcnlNb2RlOiBQcmltYXJ5Vmlld01vZGUgPSBcInRhZ3NcIjtcblx0cHJpdmF0ZSBzZWxlY3RlZFByb3BlcnR5S2V5OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBzZWxlY3RlZFRhZ0tleTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgY29sbGFwc2VkTm9kZUtleXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0cHJpdmF0ZSBtb2JpbGVQYW5lOiBNb2JpbGVQYW5lID0gXCJtYWluXCI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bGVhZjogV29ya3NwYWNlTGVhZixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogVXJzb1BsdWdpbixcblx0KSB7XG5cdFx0c3VwZXIobGVhZik7XG5cdFx0dGhpcy5wcmltYXJ5TW9kZSA9IHRoaXMucGx1Z2luLmdldFByaW1hcnlWaWV3TW9kZSgpO1xuXHRcdHRoaXMubmF2aWdhdGlvbiA9IGZhbHNlO1xuXHRcdHRoaXMuc2NvcGUgPSBuZXcgU2NvcGUodGhpcy5hcHAuc2NvcGUpO1xuXHRcdHRoaXMuc2NvcGUucmVnaXN0ZXIoW1wiTW9kXCJdLCBcIndcIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR2b2lkIHRoaXMucGx1Z2luLmNsb3NlTGFzdE5hdmlnYWJsZUxlYWYodGhpcy5sZWFmLCBldmVudCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBWSUVXX1RZUEVfVVJTTztcblx0fVxuXG5cdGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFwiVXJzb1wiO1xuXHR9XG5cblx0Z2V0SWNvbigpOiBzdHJpbmcge1xuXHRcdHJldHVybiBcImxpYnJhcnlcIjtcblx0fVxuXG5cdGdldFNlbGVjdGVkVGFnS2V5KCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLnByaW1hcnlNb2RlID09PSBcInRhZ3NcIiA/IHRoaXMuc2VsZWN0ZWRUYWdLZXkgOiBudWxsO1xuXHR9XG5cblx0Z2V0U2VsZWN0ZWRDcmVhdGVDb250ZXh0KCk6IENyZWF0ZU5vdGVDb250ZXh0IHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMucHJpbWFyeU1vZGUgPT09IFwidGFnc1wiKSB7XG5cdFx0XHRpZiAoIXRoaXMuc2VsZWN0ZWRUYWdLZXkpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IFwidGFnXCIsXG5cdFx0XHRcdHRhZ0tleTogdGhpcy5zZWxlY3RlZFRhZ0tleSA9PT0gVU5UQUdHRURfS0VZID8gbnVsbCA6IHRoaXMuc2VsZWN0ZWRUYWdLZXksXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5zZWxlY3RlZFByb3BlcnR5S2V5KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3RlZE5vZGUgPSB0aGlzLmZpbmROb2RlQnlLZXkoXG5cdFx0XHR0aGlzLnBsdWdpbi5pbmRleC5wcm9wZXJ0eVRyZWUsXG5cdFx0XHR0aGlzLnNlbGVjdGVkUHJvcGVydHlLZXksXG5cdFx0KTtcblx0XHRpZiAoIXNlbGVjdGVkTm9kZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6IFwicHJvcGVydHlcIixcblx0XHRcdHByb3BlcnR5S2V5OiBzZWxlY3RlZE5vZGUucHJvcGVydHlLZXksXG5cdFx0XHRwcm9wZXJ0eVZhbHVlOiBzZWxlY3RlZE5vZGUucHJvcGVydHlWYWx1ZSA/PyBudWxsLFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7fVxuXG5cdHJlZnJlc2goKTogdm9pZCB7XG5cdFx0Y29uc3QgdmlzaWJsZVRhZ1RyZWUgPSB0aGlzLmdldFZpc2libGVUYWdUcmVlKCk7XG5cdFx0Y29uc3QgcHJvcGVydHlUcmVlID0gdGhpcy5wbHVnaW4uaW5kZXgucHJvcGVydHlUcmVlO1xuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5zZWxlY3RlZFRhZ0tleSAmJlxuXHRcdFx0IXRoaXMuZmluZE5vZGVCeUtleSh2aXNpYmxlVGFnVHJlZSwgdGhpcy5zZWxlY3RlZFRhZ0tleSlcblx0XHQpIHtcblx0XHRcdHRoaXMuc2VsZWN0ZWRUYWdLZXkgPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuc2VsZWN0ZWRQcm9wZXJ0eUtleSAmJlxuXHRcdFx0IXRoaXMuZmluZE5vZGVCeUtleShwcm9wZXJ0eVRyZWUsIHRoaXMuc2VsZWN0ZWRQcm9wZXJ0eUtleSlcblx0XHQpIHtcblx0XHRcdHRoaXMuc2VsZWN0ZWRQcm9wZXJ0eUtleSA9IG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmdldFNlbGVjdGVkS2V5Rm9yTW9kZSh0aGlzLnByaW1hcnlNb2RlKSkge1xuXHRcdFx0dGhpcy5tb2JpbGVQYW5lID0gXCJtYWluXCI7XG5cdFx0fVxuXG5cdFx0dGhpcy5wcnVuZUNvbGxhcHNlZFN0YXRlKHZpc2libGVUYWdUcmVlLCBwcm9wZXJ0eVRyZWUpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcigpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcblx0XHRjb250ZW50RWwuZW1wdHkoKTtcblx0XHRjb250ZW50RWwuYWRkQ2xhc3MoXCJ1cnNvLXRhZ3Mtdmlldy1ob3N0XCIpO1xuXG5cdFx0Y29uc3Qgcm9vdCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby10YWdzLXZpZXdcIiB9KTtcblx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MudW5kZXJsaW5lUGlubmVkSXRlbXMpIHtcblx0XHRcdHJvb3QuYWRkQ2xhc3MoXCJ1cnNvLXRhZ3Mtdmlldy0tdW5kZXJsaW5lLXBpbm5lZFwiKTtcblx0XHR9XG5cblx0XHRjb25zdCB2aXNpYmxlVGFnVHJlZSA9IHRoaXMuZ2V0VmlzaWJsZVRhZ1RyZWUoKTtcblx0XHRpZiAodGhpcy51c2VzU2luZ2xlUGFuZUxheW91dCgpKSB7XG5cdFx0XHRyb290LmFkZENsYXNzKFwiaXMtcGhvbmUtbGF5b3V0XCIpO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHR0aGlzLm1vYmlsZVBhbmUgPT09IFwibm90ZXNcIiAmJlxuXHRcdFx0XHR0aGlzLmdldFNlbGVjdGVkS2V5Rm9yTW9kZSh0aGlzLnByaW1hcnlNb2RlKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGNvbnN0IG5vdGVzUGFuZSA9IHJvb3QuY3JlYXRlRGl2KHtcblx0XHRcdFx0XHRjbHM6IFtcInVyc28tdGFncy1wYW5lXCIsIFwidXJzby10YWdzLXBhbmUtcmlnaHRcIl0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLnJlbmRlck5vdGVzUGFuZWwobm90ZXNQYW5lLCB2aXNpYmxlVGFnVHJlZSwge1xuXHRcdFx0XHRcdHNob3dCYWNrQnV0dG9uOiB0cnVlLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwcmltYXJ5UGFuZSA9IHJvb3QuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBbXCJ1cnNvLXRhZ3MtcGFuZVwiLCBcInVyc28tdGFncy1wYW5lLWxlZnRcIl0sXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMucmVuZGVyUHJpbWFyeVBhbmVsKHByaW1hcnlQYW5lLCB2aXNpYmxlVGFnVHJlZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5hcHBseVNwbGl0UmF0aW8ocm9vdCwgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc3BsaXRQYW5lUmF0aW8pO1xuXG5cdFx0Y29uc3QgcHJpbWFyeVBhbmUgPSByb290LmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFtcInVyc28tdGFncy1wYW5lXCIsIFwidXJzby10YWdzLXBhbmUtbGVmdFwiXSxcblx0XHR9KTtcblx0XHRjb25zdCBzcGxpdHRlciA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tdGFncy1zcGxpdHRlclwiIH0pO1xuXHRcdGNvbnN0IG5vdGVzUGFuZSA9IHJvb3QuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogW1widXJzby10YWdzLXBhbmVcIiwgXCJ1cnNvLXRhZ3MtcGFuZS1yaWdodFwiXSxcblx0XHR9KTtcblxuXHRcdHRoaXMuc2V0dXBTcGxpdFJlc2l6ZXIocm9vdCwgc3BsaXR0ZXIpO1xuXHRcdHRoaXMucmVuZGVyUHJpbWFyeVBhbmVsKHByaW1hcnlQYW5lLCB2aXNpYmxlVGFnVHJlZSk7XG5cdFx0dGhpcy5yZW5kZXJOb3Rlc1BhbmVsKG5vdGVzUGFuZSwgdmlzaWJsZVRhZ1RyZWUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJQcmltYXJ5UGFuZWwoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHR2aXNpYmxlVGFnVHJlZTogVGFnTm9kZVtdLFxuXHQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5wcmltYXJ5TW9kZSA9PT0gXCJwcm9wZXJ0aWVzXCIpIHtcblx0XHRcdHRoaXMucmVuZGVyUHJvcGVydHlUcmVlKGNvbnRhaW5lciwgdGhpcy5wbHVnaW4uaW5kZXgucHJvcGVydHlUcmVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlclRhZ1RyZWUoY29udGFpbmVyLCB2aXNpYmxlVGFnVHJlZSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRhZ1RyZWUoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgbm9kZXM6IFRhZ05vZGVbXSk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyUHJpbWFyeUhlYWRlcihjb250YWluZXIsIFwiVGFnc1wiLCBub2Rlcyk7XG5cblx0XHRpZiAobm9kZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLnJlbmRlckVtcHR5U3RhdGUoXG5cdFx0XHRcdGNvbnRhaW5lcixcblx0XHRcdFx0XCJObyB0YWdzIGZvdW5kIHlldC5cIixcblx0XHRcdFx0XCJBZGQgdGFncyB0byBub3RlcyB0byBwb3B1bGF0ZSB0aGlzIHZpZXcuXCIsXG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWUgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tdGFncy10cmVlXCIgfSk7XG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHRoaXMuZ2V0T3JkZXJlZFRhZ05vZGVzKG5vZGVzKSkge1xuXHRcdFx0dGhpcy5yZW5kZXJUYWdOb2RlKHRyZWUsIG5vZGUsIDApO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUHJvcGVydHlUcmVlKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0bm9kZXM6IFByb3BlcnR5Tm9kZVtdLFxuXHQpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlclByaW1hcnlIZWFkZXIoY29udGFpbmVyLCBcIlByb3BlcnRpZXNcIiwgbm9kZXMpO1xuXG5cdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLnRyYWNrZWRQcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5yZW5kZXJFbXB0eVN0YXRlKFxuXHRcdFx0XHRjb250YWluZXIsXG5cdFx0XHRcdFwiTm8gcHJvcGVydGllcyBjb25maWd1cmVkLlwiLFxuXHRcdFx0XHRcIk1hbmFnZSB0cmFja2VkIHByb3BlcnRpZXMgaW4gVXJzbyBzZXR0aW5ncyB0byBwb3B1bGF0ZSB0aGlzIHZpZXcuXCIsXG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWUgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tdGFncy10cmVlXCIgfSk7XG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHRoaXMuZ2V0T3JkZXJlZFByb3BlcnR5Tm9kZXMobm9kZXMpKSB7XG5cdFx0XHR0aGlzLnJlbmRlclByb3BlcnR5Tm9kZSh0cmVlLCBub2RlLCAwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclByaW1hcnlIZWFkZXI8VCBleHRlbmRzIFRyZWVOb2RlTGlrZT4oXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHR0aXRsZTogc3RyaW5nLFxuXHRcdG5vZGVzOiBUW10sXG5cdCk6IHZvaWQge1xuXHRcdGNvbnN0IGhlYWRlciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby10YWdzLWhlYWRlclwiIH0pO1xuXHRcdGNvbnN0IGhlYWRlck1haW4gPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tcGFuZS1oZWFkZXItbWFpblwiIH0pO1xuXG5cdFx0Y29uc3Qgc3dpdGNoQnV0dG9uID0gaGVhZGVyTWFpbi5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IFtcblx0XHRcdFx0XCJjbGlja2FibGUtaWNvblwiLFxuXHRcdFx0XHRcInVyc28tdGFncy1oZWFkZXItYnV0dG9uXCIsXG5cdFx0XHRcdFwidXJzby1wYW5lLXN3aXRjaGVyLWJ1dHRvblwiLFxuXHRcdFx0XSxcblx0XHRcdGF0dHI6IHtcblx0XHRcdFx0dHlwZTogXCJidXR0b25cIixcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0c2V0SWNvbihzd2l0Y2hCdXR0b24sIFwiY2hldnJvbi1kb3duXCIpO1xuXHRcdHNldFRvb2x0aXAoc3dpdGNoQnV0dG9uLCBcIlN3aXRjaCBiZXR3ZWVuIHRhZ3MgYW5kIHByb3BlcnRpZXNcIik7XG5cdFx0c3dpdGNoQnV0dG9uLnNldEF0dHIoXG5cdFx0XHRcImFyaWEtbGFiZWxcIixcblx0XHRcdFwiU3dpdGNoIGJldHdlZW4gdGFncyBhbmQgcHJvcGVydGllc1wiLFxuXHRcdCk7XG5cdFx0c3dpdGNoQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHtcblx0XHRcdHRoaXMub3BlblByaW1hcnlNb2RlTWVudShldmVudCk7XG5cdFx0fSk7XG5cblx0XHRoZWFkZXJNYWluLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRhZ3MtaGVhZGVyLXRpdGxlXCIsIHRleHQ6IHRpdGxlIH0pO1xuXG5cdFx0Y29uc3QgZXhwYW5kYWJsZUtleXMgPSB0aGlzLmdldEV4cGFuZGFibGVOb2RlS2V5cyhub2Rlcyk7XG5cdFx0aWYgKGV4cGFuZGFibGVLZXlzLnNpemUgPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25zID0gaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRhZ3MtaGVhZGVyLWFjdGlvbnNcIiB9KTtcblx0XHRjb25zdCBidXR0b24gPSBhY3Rpb25zLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogW1wiY2xpY2thYmxlLWljb25cIiwgXCJ1cnNvLXRhZ3MtaGVhZGVyLWJ1dHRvblwiXSxcblx0XHRcdGF0dHI6IHtcblx0XHRcdFx0dHlwZTogXCJidXR0b25cIixcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRjb25zdCBoYXNDb2xsYXBzZWRCcmFuY2hlcyA9IHRoaXMuaGFzQ29sbGFwc2VkQnJhbmNoZXMoZXhwYW5kYWJsZUtleXMpO1xuXHRcdGNvbnN0IGljb24gPSBoYXNDb2xsYXBzZWRCcmFuY2hlc1xuXHRcdFx0PyBcImNoZXZyb25zLXVwLWRvd25cIlxuXHRcdFx0OiBcImNoZXZyb25zLWRvd24tdXBcIjtcblx0XHRjb25zdCBsYWJlbCA9IGhhc0NvbGxhcHNlZEJyYW5jaGVzID8gXCJFeHBhbmQgYWxsXCIgOiBcIkNvbGxhcHNlIGFsbFwiO1xuXG5cdFx0c2V0SWNvbihidXR0b24sIGljb24pO1xuXHRcdHNldFRvb2x0aXAoYnV0dG9uLCBsYWJlbCk7XG5cdFx0YnV0dG9uLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIGxhYmVsKTtcblx0XHRidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdHRoaXMudG9nZ2xlQWxsQnJhbmNoZXMoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVGFnTm9kZShcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG5vZGU6IFRhZ05vZGUsXG5cdFx0ZGVwdGg6IG51bWJlcixcblx0KTogdm9pZCB7XG5cdFx0Y29uc3Qgcm93ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRhZ3Mtcm93XCIgfSk7XG5cdFx0cm93LnN0eWxlLnBhZGRpbmdMZWZ0ID0gYCR7ZGVwdGggKiAxNiArIDEyfXB4YDtcblxuXHRcdGlmICh0aGlzLnNlbGVjdGVkVGFnS2V5ID09PSBub2RlLmtleSkge1xuXHRcdFx0cm93LmFkZENsYXNzKFwiaXMtc2VsZWN0ZWRcIik7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucGx1Z2luLmlzVGFnUGlubmVkKG5vZGUua2V5KSkge1xuXHRcdFx0cm93LmFkZENsYXNzKFwiaXMtcGlubmVkXCIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1haW4gPSByb3cuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tdGFncy1tYWluXCIgfSk7XG5cdFx0dGhpcy5yZW5kZXJEaXNjbG9zdXJlKG1haW4sIG5vZGUsIFwiQ29sbGFwc2UgdGFnXCIsIFwiRXhwYW5kIHRhZ1wiLCAoKSA9PiB7XG5cdFx0XHR0aGlzLnRvZ2dsZU5vZGUobm9kZSwgXCJ0YWdzXCIpO1xuXHRcdH0pO1xuXHRcdHRoaXMucmVuZGVyVGFnSWNvbihtYWluLCBub2RlKTtcblx0XHRjb25zdCBsYWJlbEdyb3VwID0gbWFpbi5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby10YWdzLWxhYmVsLWdyb3VwXCIgfSk7XG5cblx0XHRsYWJlbEdyb3VwLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFtcInVyc28tdGFncy1sYWJlbFwiLCBub2RlLmlzU3BlY2lhbCA/IFwiaXMtc3BlY2lhbFwiIDogXCJcIl0sXG5cdFx0XHR0ZXh0OiBub2RlLm5hbWUsXG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0NvdW50cykge1xuXHRcdFx0cm93LmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJ1cnNvLXRhZ3MtY291bnRcIixcblx0XHRcdFx0dGV4dDogU3RyaW5nKG5vZGUubm90ZUNvdW50KSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJvdy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdFx0dGhpcy5zZWxlY3RlZFRhZ0tleSA9IG5vZGUua2V5O1xuXHRcdFx0aWYgKHRoaXMudXNlc1NpbmdsZVBhbmVMYXlvdXQoKSkge1xuXHRcdFx0XHR0aGlzLm1vYmlsZVBhbmUgPSBcIm5vdGVzXCI7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0pO1xuXG5cdFx0cm93LmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMub3BlblRhZ0NvbnRleHRNZW51KGV2ZW50LCBub2RlKTtcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLmlzRXhwYW5kZWQobm9kZSkpIHtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5nZXRPcmRlcmVkVGFnTm9kZXMobm9kZS5jaGlsZHJlbikpIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJUYWdOb2RlKGNvbnRhaW5lciwgY2hpbGQsIGRlcHRoICsgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJQcm9wZXJ0eU5vZGUoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRub2RlOiBQcm9wZXJ0eU5vZGUsXG5cdFx0ZGVwdGg6IG51bWJlcixcblx0KTogdm9pZCB7XG5cdFx0Y29uc3Qgcm93ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRhZ3Mtcm93XCIgfSk7XG5cdFx0cm93LnN0eWxlLnBhZGRpbmdMZWZ0ID0gYCR7ZGVwdGggKiAxNiArIDEyfXB4YDtcblxuXHRcdGlmICh0aGlzLnNlbGVjdGVkUHJvcGVydHlLZXkgPT09IG5vZGUua2V5KSB7XG5cdFx0XHRyb3cuYWRkQ2xhc3MoXCJpcy1zZWxlY3RlZFwiKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5wbHVnaW4uaXNQcm9wZXJ0eVBpbm5lZChub2RlLmtleSkpIHtcblx0XHRcdHJvdy5hZGRDbGFzcyhcImlzLXBpbm5lZFwiKTtcblx0XHR9XG5cblx0XHRjb25zdCBtYWluID0gcm93LmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRhZ3MtbWFpblwiIH0pO1xuXHRcdHRoaXMucmVuZGVyRGlzY2xvc3VyZShcblx0XHRcdG1haW4sXG5cdFx0XHRub2RlLFxuXHRcdFx0XCJDb2xsYXBzZSBwcm9wZXJ0eVwiLFxuXHRcdFx0XCJFeHBhbmQgcHJvcGVydHlcIixcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0dGhpcy50b2dnbGVOb2RlKG5vZGUsIFwicHJvcGVydGllc1wiKTtcblx0XHRcdH0sXG5cdFx0KTtcblxuXHRcdHRoaXMucmVuZGVyUHJvcGVydHlJY29uKG1haW4sIG5vZGUpO1xuXG5cdFx0Y29uc3QgbGFiZWxHcm91cCA9IG1haW4uY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tdGFncy1sYWJlbC1ncm91cFwiIH0pO1xuXHRcdGxhYmVsR3JvdXAuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJ1cnNvLXRhZ3MtbGFiZWxcIixcblx0XHRcdHRleHQ6IG5vZGUubmFtZSxcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Q291bnRzKSB7XG5cdFx0XHRyb3cuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcInVyc28tdGFncy1jb3VudFwiLFxuXHRcdFx0XHR0ZXh0OiBTdHJpbmcobm9kZS5ub3RlQ291bnQpLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cm93LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG5cdFx0XHR0aGlzLnNlbGVjdGVkUHJvcGVydHlLZXkgPSBub2RlLmtleTtcblx0XHRcdGlmICh0aGlzLnVzZXNTaW5nbGVQYW5lTGF5b3V0KCkpIHtcblx0XHRcdFx0dGhpcy5tb2JpbGVQYW5lID0gXCJub3Rlc1wiO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9KTtcblxuXHRcdHJvdy5hZGRFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR0aGlzLm9wZW5Qcm9wZXJ0eUNvbnRleHRNZW51KGV2ZW50LCBub2RlKTtcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLmlzRXhwYW5kZWQobm9kZSkpIHtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5nZXRPcmRlcmVkUHJvcGVydHlOb2Rlcyhub2RlLmNoaWxkcmVuKSkge1xuXHRcdFx0XHR0aGlzLnJlbmRlclByb3BlcnR5Tm9kZShjb250YWluZXIsIGNoaWxkLCBkZXB0aCArIDEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyRGlzY2xvc3VyZShcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG5vZGU6IFRyZWVOb2RlTGlrZSxcblx0XHRjb2xsYXBzZUxhYmVsOiBzdHJpbmcsXG5cdFx0ZXhwYW5kTGFiZWw6IHN0cmluZyxcblx0XHRvblRvZ2dsZTogKCkgPT4gdm9pZCxcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgZGlzY2xvc3VyZSA9IGNvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IFtcImNsaWNrYWJsZS1pY29uXCIsIFwidXJzby10YWdzLWRpc2Nsb3N1cmVcIl0sXG5cdFx0XHRhdHRyOiB7XG5cdFx0XHRcdHR5cGU6IFwiYnV0dG9uXCIsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0aWYgKCF0aGlzLmlzRXhwYW5kYWJsZShub2RlKSkge1xuXHRcdFx0ZGlzY2xvc3VyZS5hZGRDbGFzcyhcImlzLWhpZGRlblwiKTtcblx0XHRcdGRpc2Nsb3N1cmUuc2V0QXR0cihcImFyaWEtaGlkZGVuXCIsIFwidHJ1ZVwiKTtcblx0XHRcdGRpc2Nsb3N1cmUudGFiSW5kZXggPSAtMTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpc0V4cGFuZGVkID0gdGhpcy5pc0V4cGFuZGVkKG5vZGUpO1xuXHRcdHNldEljb24oZGlzY2xvc3VyZSwgaXNFeHBhbmRlZCA/IFwiY2hldnJvbi1kb3duXCIgOiBcImNoZXZyb24tcmlnaHRcIik7XG5cdFx0c2V0VG9vbHRpcChkaXNjbG9zdXJlLCBpc0V4cGFuZGVkID8gY29sbGFwc2VMYWJlbCA6IGV4cGFuZExhYmVsKTtcblx0XHRkaXNjbG9zdXJlLnNldEF0dHIoXG5cdFx0XHRcImFyaWEtbGFiZWxcIixcblx0XHRcdGlzRXhwYW5kZWQgPyBjb2xsYXBzZUxhYmVsIDogZXhwYW5kTGFiZWwsXG5cdFx0KTtcblxuXHRcdGRpc2Nsb3N1cmUuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4ge1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRvblRvZ2dsZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJUYWdJY29uKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG5vZGU6IFRhZ05vZGUpOiB2b2lkIHtcblx0XHRjb25zdCBpY29uTmFtZSA9IHRoaXMucGx1Z2luLmdldFRhZ0ljb24obm9kZS5rZXkpO1xuXHRcdGNvbnN0IGljb25FbCA9IGNvbnRhaW5lci5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBbXCJ1cnNvLXRhZ3MtaWNvblwiLCBpY29uTmFtZSA/IFwiXCIgOiBcImlzLWVtcHR5XCJdLFxuXHRcdH0pO1xuXG5cdFx0aWYgKCFpY29uTmFtZSkge1xuXHRcdFx0aWNvbkVsLnNldEF0dHIoXCJhcmlhLWhpZGRlblwiLCBcInRydWVcIik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c2V0SWNvbihpY29uRWwsIGljb25OYW1lKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUHJvcGVydHlJY29uKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0bm9kZTogUHJvcGVydHlOb2RlLFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBpY29uTmFtZSA9IHRoaXMucGx1Z2luLmdldFByb3BlcnR5SWNvbihub2RlLmtleSk7XG5cdFx0Y29uc3QgaWNvbkVsID0gY29udGFpbmVyLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFtcInVyc28tdGFncy1pY29uXCIsIGljb25OYW1lID8gXCJcIiA6IFwiaXMtZW1wdHlcIl0sXG5cdFx0fSk7XG5cblx0XHRpZiAoIWljb25OYW1lKSB7XG5cdFx0XHRpY29uRWwuc2V0QXR0cihcImFyaWEtaGlkZGVuXCIsIFwidHJ1ZVwiKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZXRJY29uKGljb25FbCwgaWNvbk5hbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJOb3Rlc1BhbmVsKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0dmlzaWJsZVRhZ1RyZWU6IFRhZ05vZGVbXSxcblx0XHRvcHRpb25zPzogeyBzaG93QmFja0J1dHRvbj86IGJvb2xlYW4gfSxcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgaGVhZGVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLW5vdGVzLWhlYWRlclwiIH0pO1xuXHRcdGNvbnN0IGhlYWRlck1haW4gPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tcGFuZS1oZWFkZXItbWFpblwiIH0pO1xuXG5cdFx0aWYgKG9wdGlvbnM/LnNob3dCYWNrQnV0dG9uKSB7XG5cdFx0XHRjb25zdCBiYWNrQnV0dG9uID0gaGVhZGVyTWFpbi5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdGNsczogW1xuXHRcdFx0XHRcdFwiY2xpY2thYmxlLWljb25cIixcblx0XHRcdFx0XHRcInVyc28tdGFncy1oZWFkZXItYnV0dG9uXCIsXG5cdFx0XHRcdFx0XCJ1cnNvLXBhbmUtYmFjay1idXR0b25cIixcblx0XHRcdFx0XSxcblx0XHRcdFx0YXR0cjoge1xuXHRcdFx0XHRcdHR5cGU6IFwiYnV0dG9uXCIsXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdHNldEljb24oYmFja0J1dHRvbiwgXCJhcnJvdy1sZWZ0XCIpO1xuXHRcdFx0c2V0VG9vbHRpcChcblx0XHRcdFx0YmFja0J1dHRvbixcblx0XHRcdFx0dGhpcy5wcmltYXJ5TW9kZSA9PT0gXCJ0YWdzXCJcblx0XHRcdFx0XHQ/IFwiQmFjayB0byB0YWdzXCJcblx0XHRcdFx0XHQ6IFwiQmFjayB0byBwcm9wZXJ0aWVzXCIsXG5cdFx0XHQpO1xuXHRcdFx0YmFja0J1dHRvbi5zZXRBdHRyKFxuXHRcdFx0XHRcImFyaWEtbGFiZWxcIixcblx0XHRcdFx0dGhpcy5wcmltYXJ5TW9kZSA9PT0gXCJ0YWdzXCJcblx0XHRcdFx0XHQ/IFwiQmFjayB0byB0YWdzXCJcblx0XHRcdFx0XHQ6IFwiQmFjayB0byBwcm9wZXJ0aWVzXCIsXG5cdFx0XHQpO1xuXHRcdFx0YmFja0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLm1vYmlsZVBhbmUgPSBcIm1haW5cIjtcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGhlYWRlck1haW4uY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJ1cnNvLXRhZ3MtaGVhZGVyLXRpdGxlXCIsXG5cdFx0XHR0ZXh0OiB0aGlzLmdldE5vdGVzSGVhZGVyVGl0bGUodmlzaWJsZVRhZ1RyZWUpLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby10YWdzLWhlYWRlci1hY3Rpb25zXCIgfSk7XG5cdFx0Y29uc3QgY3JlYXRlQnV0dG9uID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRjbHM6IFtcImNsaWNrYWJsZS1pY29uXCIsIFwidXJzby10YWdzLWhlYWRlci1idXR0b25cIl0sXG5cdFx0XHRhdHRyOiB7XG5cdFx0XHRcdHR5cGU6IFwiYnV0dG9uXCIsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGNyZWF0ZUNvbnRleHQgPSB0aGlzLmdldFNlbGVjdGVkQ3JlYXRlQ29udGV4dCgpO1xuXHRcdGNvbnN0IGNhbkNyZWF0ZU5vdGUgPSBCb29sZWFuKGNyZWF0ZUNvbnRleHQpO1xuXHRcdGNvbnN0IGNyZWF0ZUxhYmVsID0gY2FuQ3JlYXRlTm90ZVxuXHRcdFx0PyBcIkNyZWF0ZSBub3RlXCJcblx0XHRcdDogdGhpcy5wcmltYXJ5TW9kZSA9PT0gXCJ0YWdzXCJcblx0XHRcdFx0PyBcIlNlbGVjdCBhIHRhZyBmaXJzdFwiXG5cdFx0XHRcdDogXCJTZWxlY3QgYSBwcm9wZXJ0eSBmaXJzdFwiO1xuXHRcdHNldEljb24oY3JlYXRlQnV0dG9uLCBcInBsdXNcIik7XG5cdFx0c2V0VG9vbHRpcChjcmVhdGVCdXR0b24sIGNyZWF0ZUxhYmVsKTtcblx0XHRjcmVhdGVCdXR0b24uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgY3JlYXRlTGFiZWwpO1xuXHRcdGNyZWF0ZUJ1dHRvbi5kaXNhYmxlZCA9ICFjYW5DcmVhdGVOb3RlO1xuXHRcdGlmIChjYW5DcmVhdGVOb3RlKSB7XG5cdFx0XHRjcmVhdGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5jcmVhdGVOb3RlSW5TZWxlY3RlZENvbnRleHQoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnByaW1hcnlNb2RlID09PSBcInByb3BlcnRpZXNcIikge1xuXHRcdFx0dGhpcy5yZW5kZXJQcm9wZXJ0eU5vdGVzUGFuZWwoY29udGFpbmVyKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlclRhZ05vdGVzUGFuZWwoY29udGFpbmVyLCB2aXNpYmxlVGFnVHJlZSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRhZ05vdGVzUGFuZWwoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHR2aXNpYmxlVGFnVHJlZTogVGFnTm9kZVtdLFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBzZWxlY3RlZE5vZGUgPSB0aGlzLnNlbGVjdGVkVGFnS2V5XG5cdFx0XHQ/IHRoaXMuZmluZE5vZGVCeUtleSh2aXNpYmxlVGFnVHJlZSwgdGhpcy5zZWxlY3RlZFRhZ0tleSlcblx0XHRcdDogbnVsbDtcblxuXHRcdGlmICh2aXNpYmxlVGFnVHJlZS5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMucmVuZGVyRW1wdHlTdGF0ZShcblx0XHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0XHRcIk5vdGhpbmcgdG8gc2hvdyB5ZXQuXCIsXG5cdFx0XHRcdFwiVGFnZ2VkIG5vdGVzIHdpbGwgYXBwZWFyIGhlcmUuXCIsXG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghc2VsZWN0ZWROb2RlIHx8ICF0aGlzLnNlbGVjdGVkVGFnS2V5KSB7XG5cdFx0XHR0aGlzLnJlbmRlckVtcHR5U3RhdGUoXG5cdFx0XHRcdGNvbnRhaW5lcixcblx0XHRcdFx0XCJTZWxlY3QgYSB0YWcuXCIsXG5cdFx0XHRcdFwiQ2hvb3NlIGEgdGFnIGluIHRoZSBsZWZ0IHBhbmUgdG8gYnJvd3NlIG1hdGNoaW5nIG5vdGVzLlwiLFxuXHRcdFx0KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmaWxlcyA9IHRoaXMuZ2V0T3JkZXJlZEZpbGVzRm9yVGFnKHRoaXMuc2VsZWN0ZWRUYWdLZXkpO1xuXHRcdGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMucmVuZGVyRW1wdHlTdGF0ZShcblx0XHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0XHRcIk5vIG5vdGVzIGluIHRoaXMgdGFnLlwiLFxuXHRcdFx0XHRcIlRoaXMgdGFnIGV4aXN0cywgYnV0IGl0IGRvZXMgbm90IGN1cnJlbnRseSBtYXRjaCBhbnkgbm90ZXMuXCIsXG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpc3QgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tbm90ZXMtbGlzdFwiIH0pO1xuXHRcdGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuXHRcdFx0dGhpcy5yZW5kZXJGaWxlUm93KGxpc3QsIGZpbGUsIHRoaXMuc2VsZWN0ZWRUYWdLZXkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUHJvcGVydHlOb3Rlc1BhbmVsKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MudHJhY2tlZFByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLnJlbmRlckVtcHR5U3RhdGUoXG5cdFx0XHRcdGNvbnRhaW5lcixcblx0XHRcdFx0XCJTZWxlY3QgYSBwcm9wZXJ0eS5cIixcblx0XHRcdFx0XCJDaG9vc2UgYSBwcm9wZXJ0eSBpbiB0aGUgbGVmdCBwYW5lIHRvIGJyb3dzZSBtYXRjaGluZyBub3Rlcy5cIixcblx0XHRcdCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0ZWROb2RlID0gdGhpcy5zZWxlY3RlZFByb3BlcnR5S2V5XG5cdFx0XHQ/IHRoaXMuZmluZE5vZGVCeUtleShcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5pbmRleC5wcm9wZXJ0eVRyZWUsXG5cdFx0XHRcdFx0dGhpcy5zZWxlY3RlZFByb3BlcnR5S2V5LFxuXHRcdFx0XHQpXG5cdFx0XHQ6IG51bGw7XG5cdFx0aWYgKCFzZWxlY3RlZE5vZGUgfHwgIXRoaXMuc2VsZWN0ZWRQcm9wZXJ0eUtleSkge1xuXHRcdFx0dGhpcy5yZW5kZXJFbXB0eVN0YXRlKFxuXHRcdFx0XHRjb250YWluZXIsXG5cdFx0XHRcdFwiU2VsZWN0IGEgcHJvcGVydHkuXCIsXG5cdFx0XHRcdFwiQ2hvb3NlIGEgcHJvcGVydHkgaW4gdGhlIGxlZnQgcGFuZSB0byBicm93c2UgbWF0Y2hpbmcgbm90ZXMuXCIsXG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5nZXRPcmRlcmVkRmlsZXNGb3JQcm9wZXJ0eSh0aGlzLnNlbGVjdGVkUHJvcGVydHlLZXkpO1xuXHRcdGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMucmVuZGVyRW1wdHlTdGF0ZShcblx0XHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0XHRcIk5vIG5vdGVzIHdpdGggdGhpcyBwcm9wZXJ0eS5cIixcblx0XHRcdFx0XCJUaGlzIHByb3BlcnR5IGlzIGJlaW5nIHRyYWNrZWQsIGJ1dCBpdCBkb2VzIG5vdCBjdXJyZW50bHkgbWF0Y2ggYW55IG5vdGVzLlwiLFxuXHRcdFx0KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsaXN0ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLW5vdGVzLWxpc3RcIiB9KTtcblx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcblx0XHRcdHRoaXMucmVuZGVyRmlsZVJvdyhsaXN0LCBmaWxlLCBudWxsKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckZpbGVSb3coXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRmaWxlOiBURmlsZSxcblx0XHR0YWdLZXk6IHN0cmluZyB8IG51bGwsXG5cdCk6IHZvaWQge1xuXHRcdGNvbnN0IHJvdyA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby1ub3RlLXJvd1wiIH0pO1xuXHRcdGlmICh0YWdLZXkgJiYgdGhpcy5wbHVnaW4uaXNOb3RlUGlubmVkKHRhZ0tleSwgZmlsZS5wYXRoKSkge1xuXHRcdFx0cm93LmFkZENsYXNzKFwiaXMtcGlubmVkXCIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1haW4gPSByb3cuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tbm90ZS1tYWluXCIgfSk7XG5cdFx0dGhpcy5yZW5kZXJOb3RlSWNvbihtYWluLCBmaWxlKTtcblx0XHRjb25zdCB0ZXh0R3JvdXAgPSBtYWluLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLW5vdGUtdGV4dFwiIH0pO1xuXHRcdHRleHRHcm91cC5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby1ub3RlLXRpdGxlXCIsIHRleHQ6IGZpbGUuYmFzZW5hbWUgfSk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5TGluZSA9IHRoaXMucGx1Z2luLmdldE5vdGVTZWNvbmRhcnlMaW5lKGZpbGUpO1xuXHRcdGlmIChzZWNvbmRhcnlMaW5lKSB7XG5cdFx0XHR0ZXh0R3JvdXAuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcInVyc28tbm90ZS1zZWNvbmRhcnlcIixcblx0XHRcdFx0dGV4dDogc2Vjb25kYXJ5TGluZSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJvdy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLm9wZW5GaWxlKGZpbGUpO1xuXHRcdH0pO1xuXG5cdFx0cm93LmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMub3Blbk5vdGVDb250ZXh0TWVudShldmVudCwgdGFnS2V5LCBmaWxlKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyTm90ZUljb24oY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZmlsZTogVEZpbGUpOiB2b2lkIHtcblx0XHRjb25zdCBpY29uTmFtZSA9IHRoaXMucGx1Z2luLmdldE5vdGVJY29uKGZpbGUucGF0aCk7XG5cdFx0Y29uc3QgaWNvbkVsID0gY29udGFpbmVyLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFtcInVyc28tbm90ZS1pY29uXCIsIGljb25OYW1lID8gXCJcIiA6IFwiaXMtZW1wdHlcIl0sXG5cdFx0fSk7XG5cblx0XHRpZiAoIWljb25OYW1lKSB7XG5cdFx0XHRpY29uRWwuc2V0QXR0cihcImFyaWEtaGlkZGVuXCIsIFwidHJ1ZVwiKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZXRJY29uKGljb25FbCwgaWNvbk5hbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJFbXB0eVN0YXRlKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0dGl0bGU6IHN0cmluZyxcblx0XHRkZXNjcmlwdGlvbjogc3RyaW5nLFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBzdGF0ZSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby1lbXB0eS1zdGF0ZVwiIH0pO1xuXHRcdHN0YXRlLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLWVtcHR5LXRpdGxlXCIsIHRleHQ6IHRpdGxlIH0pO1xuXHRcdHN0YXRlLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLWVtcHR5LWRlc2NyaXB0aW9uXCIsIHRleHQ6IGRlc2NyaXB0aW9uIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB0b2dnbGVOb2RlPFQgZXh0ZW5kcyBUcmVlTm9kZUxpa2U+KFxuXHRcdG5vZGU6IFQsXG5cdFx0bW9kZTogUHJpbWFyeVZpZXdNb2RlLFxuXHQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXNFeHBhbmRhYmxlKG5vZGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29sbGFwc2VkTm9kZUtleXMuaGFzKG5vZGUua2V5KSkge1xuXHRcdFx0dGhpcy5jb2xsYXBzZWROb2RlS2V5cy5kZWxldGUobm9kZS5rZXkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNvbGxhcHNlZE5vZGVLZXlzLmFkZChub2RlLmtleSk7XG5cblx0XHRcdGNvbnN0IHNlbGVjdGVkS2V5ID0gdGhpcy5nZXRTZWxlY3RlZEtleUZvck1vZGUobW9kZSk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHNlbGVjdGVkS2V5ICYmXG5cdFx0XHRcdHNlbGVjdGVkS2V5ICE9PSBub2RlLmtleSAmJlxuXHRcdFx0XHR0aGlzLmNvbnRhaW5zTm9kZUtleShub2RlLCBzZWxlY3RlZEtleSlcblx0XHRcdCkge1xuXHRcdFx0XHR0aGlzLnNldFNlbGVjdGVkS2V5Rm9yTW9kZShtb2RlLCBub2RlLmtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlQWxsQnJhbmNoZXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMucHJpbWFyeU1vZGUgPT09IFwidGFnc1wiKSB7XG5cdFx0XHR0aGlzLnRvZ2dsZUFsbEJyYW5jaGVzRm9yTm9kZXModGhpcy5nZXRWaXNpYmxlVGFnVHJlZSgpLCBcInRhZ3NcIik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy50b2dnbGVBbGxCcmFuY2hlc0Zvck5vZGVzKFxuXHRcdFx0dGhpcy5wbHVnaW4uaW5kZXgucHJvcGVydHlUcmVlLFxuXHRcdFx0XCJwcm9wZXJ0aWVzXCIsXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlQWxsQnJhbmNoZXNGb3JOb2RlczxUIGV4dGVuZHMgVHJlZU5vZGVMaWtlPihcblx0XHRub2RlczogVFtdLFxuXHRcdG1vZGU6IFByaW1hcnlWaWV3TW9kZSxcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgZXhwYW5kYWJsZUtleXMgPSB0aGlzLmdldEV4cGFuZGFibGVOb2RlS2V5cyhub2Rlcyk7XG5cdFx0aWYgKGV4cGFuZGFibGVLZXlzLnNpemUgPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5oYXNDb2xsYXBzZWRCcmFuY2hlcyhleHBhbmRhYmxlS2V5cykpIHtcblx0XHRcdHRoaXMuY29sbGFwc2VkTm9kZUtleXMuY2xlYXIoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jb2xsYXBzZWROb2RlS2V5cy5jbGVhcigpO1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgb2YgZXhwYW5kYWJsZUtleXMpIHtcblx0XHRcdFx0dGhpcy5jb2xsYXBzZWROb2RlS2V5cy5hZGQoa2V5KTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRLZXkgPSB0aGlzLmdldFNlbGVjdGVkS2V5Rm9yTW9kZShtb2RlKTtcblx0XHRcdGlmIChzZWxlY3RlZEtleSkge1xuXHRcdFx0XHRjb25zdCB2aXNpYmxlQW5jZXN0b3IgPSB0aGlzLmZpbmRUb3BMZXZlbEFuY2VzdG9yRm9yS2V5KFxuXHRcdFx0XHRcdG5vZGVzLFxuXHRcdFx0XHRcdHNlbGVjdGVkS2V5LFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRpZiAodmlzaWJsZUFuY2VzdG9yKSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRTZWxlY3RlZEtleUZvck1vZGUobW9kZSwgdmlzaWJsZUFuY2VzdG9yLmtleSk7XG5cdFx0XHRcdFx0dGhpcy5jb2xsYXBzZWROb2RlS2V5cy5kZWxldGUodmlzaWJsZUFuY2VzdG9yLmtleSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuUHJpbWFyeU1vZGVNZW51KGV2ZW50OiBNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgbWVudSA9IG5ldyBNZW51KCk7XG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiVGFnc1wiKTtcblx0XHRcdGlmICh0aGlzLnByaW1hcnlNb2RlID09PSBcInRhZ3NcIikge1xuXHRcdFx0XHRpdGVtLnNldEljb24oXCJjaGVja1wiKTtcblx0XHRcdH1cblx0XHRcdGl0ZW0ub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc3dpdGNoUHJpbWFyeU1vZGUoXCJ0YWdzXCIpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiUHJvcGVydGllc1wiKTtcblx0XHRcdGlmICh0aGlzLnByaW1hcnlNb2RlID09PSBcInByb3BlcnRpZXNcIikge1xuXHRcdFx0XHRpdGVtLnNldEljb24oXCJjaGVja1wiKTtcblx0XHRcdH1cblx0XHRcdGl0ZW0ub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc3dpdGNoUHJpbWFyeU1vZGUoXCJwcm9wZXJ0aWVzXCIpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0bWVudS5zaG93QXRNb3VzZUV2ZW50KGV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgc3dpdGNoUHJpbWFyeU1vZGUobW9kZTogUHJpbWFyeVZpZXdNb2RlKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMucHJpbWFyeU1vZGUgPT09IG1vZGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnByaW1hcnlNb2RlID0gbW9kZTtcblx0XHR2b2lkIHRoaXMucGx1Z2luLnNldFByaW1hcnlWaWV3TW9kZShtb2RlKTtcblx0XHR0aGlzLm1vYmlsZVBhbmUgPSBcIm1haW5cIjtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPcmRlcmVkVGFnTm9kZXMobm9kZXM6IFRhZ05vZGVbXSk6IFRhZ05vZGVbXSB7XG5cdFx0aWYgKG5vZGVzLmxlbmd0aCA8PSAxKSB7XG5cdFx0XHRyZXR1cm4gbm9kZXM7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlyc3ROb2RlID0gbm9kZXNbMF07XG5cdFx0Y29uc3QgbGFzdE5vZGUgPSBub2Rlc1tub2Rlcy5sZW5ndGggLSAxXTtcblx0XHRjb25zdCBvcmRlcmVkUmVndWxhck5vZGVzID0gdGhpcy5wYXJ0aXRpb25QaW5uZWRJdGVtcyhcblx0XHRcdG5vZGVzLmZpbHRlcigobm9kZSkgPT4gIW5vZGUuaXNTcGVjaWFsKSxcblx0XHRcdChub2RlKSA9PiB0aGlzLnBsdWdpbi5pc1RhZ1Bpbm5lZChub2RlLmtleSksXG5cdFx0KTtcblxuXHRcdGlmIChmaXJzdE5vZGU/LmlzU3BlY2lhbCkge1xuXHRcdFx0cmV0dXJuIFtmaXJzdE5vZGUsIC4uLm9yZGVyZWRSZWd1bGFyTm9kZXNdO1xuXHRcdH1cblxuXHRcdGlmIChsYXN0Tm9kZT8uaXNTcGVjaWFsKSB7XG5cdFx0XHRyZXR1cm4gWy4uLm9yZGVyZWRSZWd1bGFyTm9kZXMsIGxhc3ROb2RlXTtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3JkZXJlZFJlZ3VsYXJOb2Rlcztcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3JkZXJlZFByb3BlcnR5Tm9kZXMobm9kZXM6IFByb3BlcnR5Tm9kZVtdKTogUHJvcGVydHlOb2RlW10ge1xuXHRcdGlmIChub2Rlcy5sZW5ndGggPD0gMSkge1xuXHRcdFx0cmV0dXJuIG5vZGVzO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnBhcnRpdGlvblBpbm5lZEl0ZW1zKG5vZGVzLCAobm9kZSkgPT5cblx0XHRcdHRoaXMucGx1Z2luLmlzUHJvcGVydHlQaW5uZWQobm9kZS5rZXkpLFxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGdldE9yZGVyZWRGaWxlc0ZvclRhZyh0YWdLZXk6IHN0cmluZyk6IFRGaWxlW10ge1xuXHRcdGNvbnN0IGZpbGVzID0gdGhpcy5wbHVnaW4uaW5kZXgubm90ZXNCeVRhZy5nZXQodGFnS2V5KSA/PyBbXTtcblx0XHRyZXR1cm4gdGhpcy5wYXJ0aXRpb25QaW5uZWRJdGVtcyhcblx0XHRcdGZpbGVzLFxuXHRcdFx0KGZpbGUpID0+IHRoaXMucGx1Z2luLmlzTm90ZVBpbm5lZCh0YWdLZXksIGZpbGUucGF0aCksXG5cdFx0XHQobGVmdCwgcmlnaHQpID0+IHRoaXMuY29tcGFyZUZpbGVzKGxlZnQsIHJpZ2h0KSxcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPcmRlcmVkRmlsZXNGb3JQcm9wZXJ0eShwcm9wZXJ0eU5vZGVLZXk6IHN0cmluZyk6IFRGaWxlW10ge1xuXHRcdGNvbnN0IGZpbGVzID1cblx0XHRcdHRoaXMucGx1Z2luLmluZGV4Lm5vdGVzQnlQcm9wZXJ0eS5nZXQocHJvcGVydHlOb2RlS2V5KSA/PyBbXTtcblx0XHRyZXR1cm4gWy4uLmZpbGVzXS5zb3J0KChsZWZ0LCByaWdodCkgPT4gdGhpcy5jb21wYXJlRmlsZXMobGVmdCwgcmlnaHQpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Tm90ZXNIZWFkZXJUaXRsZSh2aXNpYmxlVGFnVHJlZTogVGFnTm9kZVtdKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5wcmltYXJ5TW9kZSA9PT0gXCJ0YWdzXCIpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkTm9kZSA9IHRoaXMuc2VsZWN0ZWRUYWdLZXlcblx0XHRcdFx0PyB0aGlzLmZpbmROb2RlQnlLZXkodmlzaWJsZVRhZ1RyZWUsIHRoaXMuc2VsZWN0ZWRUYWdLZXkpXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHJldHVybiBzZWxlY3RlZE5vZGUgPyBzZWxlY3RlZE5vZGUubmFtZSA6IFwiTm90ZXNcIjtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3RlZE5vZGUgPSB0aGlzLnNlbGVjdGVkUHJvcGVydHlLZXlcblx0XHRcdD8gdGhpcy5maW5kTm9kZUJ5S2V5KFxuXHRcdFx0XHRcdHRoaXMucGx1Z2luLmluZGV4LnByb3BlcnR5VHJlZSxcblx0XHRcdFx0XHR0aGlzLnNlbGVjdGVkUHJvcGVydHlLZXksXG5cdFx0XHRcdClcblx0XHRcdDogbnVsbDtcblx0XHRpZiAoIXNlbGVjdGVkTm9kZSkge1xuXHRcdFx0cmV0dXJuIFwiTm90ZXNcIjtcblx0XHR9XG5cblx0XHRyZXR1cm4gc2VsZWN0ZWROb2RlLnByb3BlcnR5VmFsdWVcblx0XHRcdD8gYCR7c2VsZWN0ZWROb2RlLnByb3BlcnR5S2V5fTogJHtzZWxlY3RlZE5vZGUucHJvcGVydHlWYWx1ZX1gXG5cdFx0XHQ6IHNlbGVjdGVkTm9kZS5uYW1lO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZWxlY3RlZEtleUZvck1vZGUobW9kZTogUHJpbWFyeVZpZXdNb2RlKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIG1vZGUgPT09IFwidGFnc1wiID8gdGhpcy5zZWxlY3RlZFRhZ0tleSA6IHRoaXMuc2VsZWN0ZWRQcm9wZXJ0eUtleTtcblx0fVxuXG5cdHByaXZhdGUgc2V0U2VsZWN0ZWRLZXlGb3JNb2RlKFxuXHRcdG1vZGU6IFByaW1hcnlWaWV3TW9kZSxcblx0XHRrZXk6IHN0cmluZyB8IG51bGwsXG5cdCk6IHZvaWQge1xuXHRcdGlmIChtb2RlID09PSBcInRhZ3NcIikge1xuXHRcdFx0dGhpcy5zZWxlY3RlZFRhZ0tleSA9IGtleTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNlbGVjdGVkUHJvcGVydHlLZXkgPSBrZXk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmROb2RlQnlLZXk8VCBleHRlbmRzIFRyZWVOb2RlTGlrZT4oXG5cdFx0bm9kZXM6IFRbXSxcblx0XHRrZXk6IHN0cmluZyxcblx0KTogVCB8IG51bGwge1xuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuXHRcdFx0aWYgKG5vZGUua2V5ID09PSBrZXkpIHtcblx0XHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoaWxkTWF0Y2ggPSB0aGlzLmZpbmROb2RlQnlLZXkobm9kZS5jaGlsZHJlbiBhcyBUW10sIGtleSk7XG5cdFx0XHRpZiAoY2hpbGRNYXRjaCkge1xuXHRcdFx0XHRyZXR1cm4gY2hpbGRNYXRjaDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgY29udGFpbnNOb2RlS2V5PFQgZXh0ZW5kcyBUcmVlTm9kZUxpa2U+KFxuXHRcdG5vZGU6IFQsXG5cdFx0a2V5OiBzdHJpbmcsXG5cdCk6IGJvb2xlYW4ge1xuXHRcdGlmIChub2RlLmtleSA9PT0ga2V5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdGlmICh0aGlzLmNvbnRhaW5zTm9kZUtleShjaGlsZCBhcyBULCBrZXkpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZmluZFRvcExldmVsQW5jZXN0b3JGb3JLZXk8VCBleHRlbmRzIFRyZWVOb2RlTGlrZT4oXG5cdFx0bm9kZXM6IFRbXSxcblx0XHRrZXk6IHN0cmluZyxcblx0KTogVCB8IG51bGwge1xuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuXHRcdFx0aWYgKHRoaXMuY29udGFpbnNOb2RlS2V5KG5vZGUsIGtleSkpIHtcblx0XHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGdldEV4cGFuZGFibGVOb2RlS2V5czxUIGV4dGVuZHMgVHJlZU5vZGVMaWtlPihcblx0XHRub2RlczogVFtdLFxuXHRcdGtleXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldDxzdHJpbmc+KCksXG5cdCk6IFNldDxzdHJpbmc+IHtcblx0XHRmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcblx0XHRcdGlmICh0aGlzLmlzRXhwYW5kYWJsZShub2RlKSkge1xuXHRcdFx0XHRrZXlzLmFkZChub2RlLmtleSk7XG5cdFx0XHRcdHRoaXMuZ2V0RXhwYW5kYWJsZU5vZGVLZXlzKG5vZGUuY2hpbGRyZW4gYXMgVFtdLCBrZXlzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ga2V5cztcblx0fVxuXG5cdHByaXZhdGUgaGFzQ29sbGFwc2VkQnJhbmNoZXMoZXhwYW5kYWJsZUtleXM6IFNldDxzdHJpbmc+KTogYm9vbGVhbiB7XG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgZXhwYW5kYWJsZUtleXMpIHtcblx0XHRcdGlmICh0aGlzLmNvbGxhcHNlZE5vZGVLZXlzLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgaXNFeHBhbmRhYmxlKG5vZGU6IFRyZWVOb2RlTGlrZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBub2RlLmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRwcml2YXRlIGlzRXhwYW5kZWQobm9kZTogVHJlZU5vZGVMaWtlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmNvbGxhcHNlZE5vZGVLZXlzLmhhcyhub2RlLmtleSk7XG5cdH1cblxuXHRwcml2YXRlIHBydW5lQ29sbGFwc2VkU3RhdGUoXG5cdFx0dGFnTm9kZXM6IFRhZ05vZGVbXSxcblx0XHRwcm9wZXJ0eU5vZGVzOiBQcm9wZXJ0eU5vZGVbXSxcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgZXhwYW5kYWJsZUtleXMgPSB0aGlzLmdldEV4cGFuZGFibGVOb2RlS2V5cyhcblx0XHRcdHRhZ05vZGVzLFxuXHRcdFx0dGhpcy5nZXRFeHBhbmRhYmxlTm9kZUtleXMocHJvcGVydHlOb2RlcyksXG5cdFx0KTtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBBcnJheS5mcm9tKHRoaXMuY29sbGFwc2VkTm9kZUtleXMpKSB7XG5cdFx0XHRpZiAoIWV4cGFuZGFibGVLZXlzLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHRoaXMuY29sbGFwc2VkTm9kZUtleXMuZGVsZXRlKGtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRWaXNpYmxlVGFnVHJlZSgpOiBUYWdOb2RlW10ge1xuXHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5oaWRkZW5UYWdzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMucGx1Z2luLmluZGV4LnRhZ1RyZWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGlkZGVuVGFncyA9IG5ldyBTZXQodGhpcy5wbHVnaW4uc2V0dGluZ3MuaGlkZGVuVGFncyk7XG5cdFx0cmV0dXJuIHRoaXMuZmlsdGVySGlkZGVuTm9kZXModGhpcy5wbHVnaW4uaW5kZXgudGFnVHJlZSwgaGlkZGVuVGFncyk7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckhpZGRlbk5vZGVzKFxuXHRcdG5vZGVzOiBUYWdOb2RlW10sXG5cdFx0aGlkZGVuVGFnczogU2V0PHN0cmluZz4sXG5cdCk6IFRhZ05vZGVbXSB7XG5cdFx0Y29uc3QgdmlzaWJsZU5vZGVzOiBUYWdOb2RlW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcblx0XHRcdGlmIChoaWRkZW5UYWdzLmhhcyhub2RlLmtleSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHZpc2libGVOb2Rlcy5wdXNoKHtcblx0XHRcdFx0Li4ubm9kZSxcblx0XHRcdFx0Y2hpbGRyZW46IHRoaXMuZmlsdGVySGlkZGVuTm9kZXMobm9kZS5jaGlsZHJlbiwgaGlkZGVuVGFncyksXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdmlzaWJsZU5vZGVzO1xuXHR9XG5cblx0cHJpdmF0ZSB1c2VzU2luZ2xlUGFuZUxheW91dCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0UGxhdGZvcm0uaXNQaG9uZSB8fFxuXHRcdFx0KFBsYXRmb3JtLmlzVGFibGV0ICYmIHRoaXMucGx1Z2luLnNldHRpbmdzLnVzZU1vYmlsZUxheW91dE9uVGFibGV0KVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwU3BsaXRSZXNpemVyKHJvb3Q6IEhUTUxFbGVtZW50LCBoYW5kbGU6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0aGFuZGxlLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiUmVzaXplIHBhbmVzXCIpO1xuXHRcdGhhbmRsZS5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcmRvd25cIiwgKGV2ZW50OiBQb2ludGVyRXZlbnQpID0+IHtcblx0XHRcdGlmIChldmVudC5idXR0b24gIT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdGxldCBuZXh0UmF0aW8gPSB0aGlzLmFwcGx5U3BsaXRSYXRpbyhcblx0XHRcdFx0cm9vdCxcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc3BsaXRQYW5lUmF0aW8sXG5cdFx0XHQpO1xuXHRcdFx0cm9vdC5hZGRDbGFzcyhcImlzLXJlc2l6aW5nXCIpO1xuXG5cdFx0XHRjb25zdCB1cGRhdGVSYXRpbyA9IChwb2ludGVyRXZlbnQ6IFBvaW50ZXJFdmVudCk6IHZvaWQgPT4ge1xuXHRcdFx0XHRjb25zdCByZWN0ID0gcm9vdC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0aWYgKHJlY3Qud2lkdGggPD0gMCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG5leHRSYXRpbyA9IHRoaXMuYXBwbHlTcGxpdFJhdGlvKFxuXHRcdFx0XHRcdHJvb3QsXG5cdFx0XHRcdFx0KHBvaW50ZXJFdmVudC5jbGllbnRYIC0gcmVjdC5sZWZ0KSAvIHJlY3Qud2lkdGgsXG5cdFx0XHRcdCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBmaW5pc2hSZXNpemUgPSAoKTogdm9pZCA9PiB7XG5cdFx0XHRcdHJvb3QucmVtb3ZlQ2xhc3MoXCJpcy1yZXNpemluZ1wiKTtcblx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJwb2ludGVybW92ZVwiLCB1cGRhdGVSYXRpbyk7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcnVwXCIsIGZpbmlzaFJlc2l6ZSk7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcmNhbmNlbFwiLCBmaW5pc2hSZXNpemUpO1xuXG5cdFx0XHRcdGlmIChuZXh0UmF0aW8gIT09IHRoaXMucGx1Z2luLnNldHRpbmdzLnNwbGl0UGFuZVJhdGlvKSB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc3BsaXRQYW5lUmF0aW8gPSBuZXh0UmF0aW87XG5cdFx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVybW92ZVwiLCB1cGRhdGVSYXRpbyk7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCBmaW5pc2hSZXNpemUpO1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVyY2FuY2VsXCIsIGZpbmlzaFJlc2l6ZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5U3BsaXRSYXRpbyhyb290OiBIVE1MRWxlbWVudCwgcmF0aW86IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgY2xhbXBlZFJhdGlvID0gdGhpcy5jbGFtcFNwbGl0UmF0aW8ocm9vdCwgcmF0aW8pO1xuXHRcdHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoXG5cdFx0XHRcIi0tdXJzby1sZWZ0LXBhbmUtc2l6ZVwiLFxuXHRcdFx0YCR7Y2xhbXBlZFJhdGlvICogMTAwfSVgLFxuXHRcdCk7XG5cdFx0cmV0dXJuIGNsYW1wZWRSYXRpbztcblx0fVxuXG5cdHByaXZhdGUgY2xhbXBTcGxpdFJhdGlvKHJvb3Q6IEhUTUxFbGVtZW50LCByYXRpbzogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCB3aWR0aCA9IHJvb3QuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XG5cdFx0aWYgKHdpZHRoIDw9IDApIHtcblx0XHRcdHJldHVybiBNYXRoLm1pbigwLjc1LCBNYXRoLm1heCgwLjI1LCByYXRpbykpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1pblBhbmVXaWR0aCA9IE1hdGgubWluKDE4MCwgd2lkdGggKiAwLjM1KTtcblx0XHRjb25zdCBtaW5SYXRpbyA9IE1hdGgubWluKDAuNDUsIG1pblBhbmVXaWR0aCAvIHdpZHRoKTtcblx0XHRyZXR1cm4gTWF0aC5taW4oMSAtIG1pblJhdGlvLCBNYXRoLm1heChtaW5SYXRpbywgcmF0aW8pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbkZpbGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByZWNlbnRMZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldE1vc3RSZWNlbnRMZWFmKCk7XG5cdFx0Y29uc3QgdGFyZ2V0TGVhZiA9XG5cdFx0XHRyZWNlbnRMZWFmICYmXG5cdFx0XHRyZWNlbnRMZWFmICE9PSB0aGlzLmxlYWYgJiZcblx0XHRcdHJlY2VudExlYWYuZ2V0Vmlld1N0YXRlKCkudHlwZSAhPT0gVklFV19UWVBFX1VSU09cblx0XHRcdFx0PyByZWNlbnRMZWFmXG5cdFx0XHRcdDogdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoXCJ0YWJcIik7XG5cblx0XHRhd2FpdCB0YXJnZXRMZWFmLm9wZW5GaWxlKGZpbGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuVGFnQ29udGV4dE1lbnUoZXZlbnQ6IE1vdXNlRXZlbnQsIG5vZGU6IFRhZ05vZGUpOiB2b2lkIHtcblx0XHRjb25zdCBtZW51ID0gbmV3IE1lbnUoKTtcblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW0uc2V0VGl0bGUoXG5cdFx0XHRcdHRoaXMucGx1Z2luLmlzVGFnUGlubmVkKG5vZGUua2V5KSA/IFwiVW5waW4gdGFnXCIgOiBcIlBpbiB0YWdcIixcblx0XHRcdClcblx0XHRcdFx0LnNldEljb24oXCJwaW5cIilcblx0XHRcdFx0Lm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4udG9nZ2xlVGFnUGluKG5vZGUua2V5KTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiU2V0IGljb25cIilcblx0XHRcdFx0LnNldEljb24oXCJpbWFnZVwiKVxuXHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuVGFnSWNvblBpY2tlcihub2RlKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0aWYgKCFub2RlLmlzU3BlY2lhbCkge1xuXHRcdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRcdGl0ZW0uc2V0VGl0bGUoXCJIaWRlIHRhZ1wiKVxuXHRcdFx0XHRcdC5zZXRJY29uKFwiZXllLW9mZlwiKVxuXHRcdFx0XHRcdC5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4uaGlkZVRhZyhub2RlLmtleSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0bWVudS5zaG93QXRNb3VzZUV2ZW50KGV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgb3BlblByb3BlcnR5Q29udGV4dE1lbnUoXG5cdFx0ZXZlbnQ6IE1vdXNlRXZlbnQsXG5cdFx0bm9kZTogUHJvcGVydHlOb2RlLFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBtZW51ID0gbmV3IE1lbnUoKTtcblx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdGl0ZW0uc2V0VGl0bGUoXG5cdFx0XHRcdHRoaXMucGx1Z2luLmlzUHJvcGVydHlQaW5uZWQobm9kZS5rZXkpXG5cdFx0XHRcdFx0PyBcIlVucGluIHByb3BlcnR5XCJcblx0XHRcdFx0XHQ6IFwiUGluIHByb3BlcnR5XCIsXG5cdFx0XHQpXG5cdFx0XHRcdC5zZXRJY29uKFwicGluXCIpXG5cdFx0XHRcdC5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLnRvZ2dsZVByb3BlcnR5UGluKG5vZGUua2V5KTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiU2V0IGljb25cIilcblx0XHRcdFx0LnNldEljb24oXCJpbWFnZVwiKVxuXHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuUHJvcGVydHlJY29uUGlja2VyKG5vZGUpO1xuXHRcdFx0XHR9KTtcblx0XHR9KTtcblx0XHRtZW51LnNob3dBdE1vdXNlRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuTm90ZUNvbnRleHRNZW51KFxuXHRcdGV2ZW50OiBNb3VzZUV2ZW50LFxuXHRcdHRhZ0tleTogc3RyaW5nIHwgbnVsbCxcblx0XHRmaWxlOiBURmlsZSxcblx0KTogdm9pZCB7XG5cdFx0Y29uc3QgbWVudSA9IG5ldyBNZW51KCk7XG5cdFx0aWYgKHRhZ0tleSkge1xuXHRcdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRcdGl0ZW0uc2V0VGl0bGUoXG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uaXNOb3RlUGlubmVkKHRhZ0tleSwgZmlsZS5wYXRoKVxuXHRcdFx0XHRcdFx0PyBcIlVucGluIG5vdGVcIlxuXHRcdFx0XHRcdFx0OiBcIlBpbiBub3RlXCIsXG5cdFx0XHRcdClcblx0XHRcdFx0XHQuc2V0SWNvbihcInBpblwiKVxuXHRcdFx0XHRcdC5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHZvaWQgdGhpcy5wbHVnaW4udG9nZ2xlTm90ZVBpbih0YWdLZXksIGZpbGUucGF0aCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiU2V0IGljb25cIilcblx0XHRcdFx0LnNldEljb24oXCJpbWFnZVwiKVxuXHRcdFx0XHQub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuTm90ZUljb25QaWNrZXIoZmlsZSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdG1lbnUuYWRkU2VwYXJhdG9yKCk7XG5cdFx0bWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG5cdFx0XHRpdGVtLnNldFRpdGxlKFwiRGVsZXRlIG5vdGVcIilcblx0XHRcdFx0LnNldEljb24oXCJ0cmFzaC0yXCIpXG5cdFx0XHRcdC5zZXRXYXJuaW5nKHRydWUpXG5cdFx0XHRcdC5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHR2b2lkIHRoaXMucGx1Z2luLmRlbGV0ZU5vdGUoZmlsZSk7XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdG1lbnUuc2hvd0F0TW91c2VFdmVudChldmVudCk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5UYWdJY29uUGlja2VyKG5vZGU6IFRhZ05vZGUpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RhbCA9IG5ldyBUYWdJY29uUGlja2VyTW9kYWwodGhpcy5hcHAsIHtcblx0XHRcdHRhZ0xhYmVsOiBub2RlLm5hbWUsXG5cdFx0XHRjdXJyZW50SWNvbjogdGhpcy5wbHVnaW4uZ2V0VGFnSWNvbihub2RlLmtleSksXG5cdFx0XHRvbkNob29zZTogYXN5bmMgKGljb25OYW1lKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNldFRhZ0ljb24obm9kZS5rZXksIGljb25OYW1lKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRtb2RhbC5vcGVuKCk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5Qcm9wZXJ0eUljb25QaWNrZXIobm9kZTogUHJvcGVydHlOb2RlKTogdm9pZCB7XG5cdFx0Y29uc3QgbGFiZWwgPSBub2RlLnByb3BlcnR5VmFsdWVcblx0XHRcdD8gYCR7bm9kZS5wcm9wZXJ0eUtleX06ICR7bm9kZS5wcm9wZXJ0eVZhbHVlfWBcblx0XHRcdDogbm9kZS5uYW1lO1xuXHRcdGNvbnN0IG1vZGFsID0gbmV3IFRhZ0ljb25QaWNrZXJNb2RhbCh0aGlzLmFwcCwge1xuXHRcdFx0dGFnTGFiZWw6IGxhYmVsLFxuXHRcdFx0Y3VycmVudEljb246IHRoaXMucGx1Z2luLmdldFByb3BlcnR5SWNvbihub2RlLmtleSksXG5cdFx0XHRvbkNob29zZTogYXN5bmMgKGljb25OYW1lKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNldFByb3BlcnR5SWNvbihub2RlLmtleSwgaWNvbk5hbWUpO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdG1vZGFsLm9wZW4oKTtcblx0fVxuXG5cdHByaXZhdGUgb3Blbk5vdGVJY29uUGlja2VyKGZpbGU6IFRGaWxlKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kYWwgPSBuZXcgVGFnSWNvblBpY2tlck1vZGFsKHRoaXMuYXBwLCB7XG5cdFx0XHR0YWdMYWJlbDogZmlsZS5iYXNlbmFtZSxcblx0XHRcdGN1cnJlbnRJY29uOiB0aGlzLnBsdWdpbi5nZXROb3RlSWNvbihmaWxlLnBhdGgpLFxuXHRcdFx0b25DaG9vc2U6IGFzeW5jIChpY29uTmFtZSkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zZXROb3RlSWNvbihmaWxlLnBhdGgsIGljb25OYW1lKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRtb2RhbC5vcGVuKCk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXBhcmVGaWxlcyhsZWZ0OiBURmlsZSwgcmlnaHQ6IFRGaWxlKTogbnVtYmVyIHtcblx0XHRzd2l0Y2ggKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVzU29ydE9yZGVyKSB7XG5cdFx0XHRjYXNlIFwidXBkYXRlZC1kZXNjXCI6XG5cdFx0XHRcdHJldHVybiB0aGlzLmNvbXBhcmVOdW1iZXJzKFxuXHRcdFx0XHRcdHJpZ2h0LnN0YXQubXRpbWUsXG5cdFx0XHRcdFx0bGVmdC5zdGF0Lm10aW1lLFxuXHRcdFx0XHRcdGxlZnQsXG5cdFx0XHRcdFx0cmlnaHQsXG5cdFx0XHRcdCk7XG5cdFx0XHRjYXNlIFwidXBkYXRlZC1hc2NcIjpcblx0XHRcdFx0cmV0dXJuIHRoaXMuY29tcGFyZU51bWJlcnMoXG5cdFx0XHRcdFx0bGVmdC5zdGF0Lm10aW1lLFxuXHRcdFx0XHRcdHJpZ2h0LnN0YXQubXRpbWUsXG5cdFx0XHRcdFx0bGVmdCxcblx0XHRcdFx0XHRyaWdodCxcblx0XHRcdFx0KTtcblx0XHRcdGNhc2UgXCJjcmVhdGVkLWRlc2NcIjpcblx0XHRcdFx0cmV0dXJuIHRoaXMuY29tcGFyZU51bWJlcnMoXG5cdFx0XHRcdFx0cmlnaHQuc3RhdC5jdGltZSxcblx0XHRcdFx0XHRsZWZ0LnN0YXQuY3RpbWUsXG5cdFx0XHRcdFx0bGVmdCxcblx0XHRcdFx0XHRyaWdodCxcblx0XHRcdFx0KTtcblx0XHRcdGNhc2UgXCJjcmVhdGVkLWFzY1wiOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jb21wYXJlTnVtYmVycyhcblx0XHRcdFx0XHRsZWZ0LnN0YXQuY3RpbWUsXG5cdFx0XHRcdFx0cmlnaHQuc3RhdC5jdGltZSxcblx0XHRcdFx0XHRsZWZ0LFxuXHRcdFx0XHRcdHJpZ2h0LFxuXHRcdFx0XHQpO1xuXHRcdFx0Y2FzZSBcInRpdGxlLWFzY1wiOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jb21wYXJlRmlsZU5hbWVzKGxlZnQsIHJpZ2h0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbXBhcmVOdW1iZXJzKFxuXHRcdGxlZnQ6IG51bWJlcixcblx0XHRyaWdodDogbnVtYmVyLFxuXHRcdGxlZnRGaWxlOiBURmlsZSxcblx0XHRyaWdodEZpbGU6IFRGaWxlLFxuXHQpOiBudW1iZXIge1xuXHRcdGlmIChsZWZ0ID09PSByaWdodCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29tcGFyZUZpbGVOYW1lcyhsZWZ0RmlsZSwgcmlnaHRGaWxlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbGVmdCAtIHJpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wYXJlRmlsZU5hbWVzKGxlZnQ6IFRGaWxlLCByaWdodDogVEZpbGUpOiBudW1iZXIge1xuXHRcdGNvbnN0IG5hbWVDb21wYXJpc29uID0gbGVmdC5iYXNlbmFtZS5sb2NhbGVDb21wYXJlKFxuXHRcdFx0cmlnaHQuYmFzZW5hbWUsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR7IHNlbnNpdGl2aXR5OiBcImJhc2VcIiB9LFxuXHRcdCk7XG5cdFx0aWYgKG5hbWVDb21wYXJpc29uICE9PSAwKSB7XG5cdFx0XHRyZXR1cm4gbmFtZUNvbXBhcmlzb247XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxlZnQucGF0aC5sb2NhbGVDb21wYXJlKHJpZ2h0LnBhdGgsIHVuZGVmaW5lZCwge1xuXHRcdFx0c2Vuc2l0aXZpdHk6IFwiYmFzZVwiLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBwYXJ0aXRpb25QaW5uZWRJdGVtczxUPihcblx0XHRpdGVtczogVFtdLFxuXHRcdGlzUGlubmVkOiAoaXRlbTogVCkgPT4gYm9vbGVhbixcblx0XHRjb21wYXJlPzogKGxlZnQ6IFQsIHJpZ2h0OiBUKSA9PiBudW1iZXIsXG5cdCk6IFRbXSB7XG5cdFx0Y29uc3QgcGlubmVkSXRlbXM6IFRbXSA9IFtdO1xuXHRcdGNvbnN0IHVucGlubmVkSXRlbXM6IFRbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG5cdFx0XHRpZiAoaXNQaW5uZWQoaXRlbSkpIHtcblx0XHRcdFx0cGlubmVkSXRlbXMucHVzaChpdGVtKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVucGlubmVkSXRlbXMucHVzaChpdGVtKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoY29tcGFyZSkge1xuXHRcdFx0cGlubmVkSXRlbXMuc29ydChjb21wYXJlKTtcblx0XHRcdHVucGlubmVkSXRlbXMuc29ydChjb21wYXJlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gWy4uLnBpbm5lZEl0ZW1zLCAuLi51bnBpbm5lZEl0ZW1zXTtcblx0fVxufVxuIl19