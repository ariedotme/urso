import { __awaiter } from "tslib";
import { moment, PluginSettingTab, Setting } from "obsidian";
import { FolderPathSuggest } from "./folder-path-suggest";
import { HiddenTagsModal } from "./hidden-tags-modal";
import { TrackedPropertiesModal } from "./tracked-properties-modal";
export const DEFAULT_SETTINGS = {
    hiddenTags: [],
    inheritanceMode: "include-ancestors",
    pinnedNotes: {},
    pinnedProperties: [],
    pinnedTags: [],
    newNoteFolder: "",
    noteDateFormat: "MMMM D",
    noteIcons: {},
    noteSecondaryLineMode: "updated-date",
    notesSortOrder: "updated-desc",
    primaryViewMode: "tags",
    propertyIcons: {},
    splitPaneRatio: 0.4,
    showCounts: true,
    trackedProperties: [],
    tagIcons: {},
    showUntagged: true,
    underlinePinnedItems: true,
    untaggedLabel: "Inbox",
    untaggedPosition: "top",
    useMobileLayoutOnTablet: false,
};
export class UrsoSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.folderPathSuggest = null;
        this.plugin = plugin;
    }
    display() {
        var _a;
        const { containerEl } = this;
        containerEl.empty();
        (_a = this.folderPathSuggest) === null || _a === void 0 ? void 0 : _a.close();
        this.folderPathSuggest = null;
        new Setting(containerEl).setName("Layout").setHeading();
        new Setting(containerEl)
            .setName("Use mobile layout on tablet")
            .setDesc("Only affects tablets. Show one pane at a time like phones instead of the split view.")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.useMobileLayoutOnTablet).onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.useMobileLayoutOnTablet = value;
            yield this.commit();
        })));
        new Setting(containerEl).setName("Tag tree").setHeading();
        new Setting(containerEl)
            .setName("Inheritance mode")
            .setDesc("Choose whether notes tagged with nested tags also appear in their parent tags.")
            .addDropdown((dropdown) => dropdown
            .addOption("include-ancestors", "Include parent tags")
            .addOption("leaf-only", "Only most specific tag")
            .setValue(this.plugin.settings.inheritanceMode)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.inheritanceMode = value;
            yield this.commit({ rebuildIndex: true });
        })));
        new Setting(containerEl)
            .setName("Show counts")
            .setDesc("Display the number of matching notes beside each tag.")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.showCounts).onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.showCounts = value;
            yield this.commit();
        })));
        new Setting(containerEl)
            .setName("Hidden tags")
            .setDesc("Manage tags that should be removed from the explorer tree.")
            .addButton((button) => button.setButtonText("Manage").onClick(() => {
            new HiddenTagsModal(this.app, this.plugin).open();
        }));
        new Setting(containerEl).setName("Properties").setHeading();
        new Setting(containerEl)
            .setName("Tracked properties")
            .setDesc("Choose which properties appear in the explorer and whether they group notes by value.")
            .addButton((button) => button.setButtonText("Manage").onClick(() => {
            new TrackedPropertiesModal(this.app, this.plugin).open();
        }));
        new Setting(containerEl).setName("Notes list").setHeading();
        new Setting(containerEl)
            .setName("Sort notes by")
            .setDesc("Choose how notes are ordered inside each tag.")
            .addDropdown((dropdown) => dropdown
            .addOption("updated-desc", "Last updated")
            .addOption("updated-asc", "First updated")
            .addOption("created-desc", "Last created")
            .addOption("created-asc", "First created")
            .addOption("title-asc", "Title")
            .setValue(this.plugin.settings.notesSortOrder)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.notesSortOrder = value;
            yield this.commit();
        })));
        let noteDateFormatSetting;
        new Setting(containerEl)
            .setName("Secondary line")
            .setDesc("Choose whether the notes list shows the created date, updated date, or nothing.")
            .addDropdown((dropdown) => dropdown
            .addOption("updated-date", "Updated date")
            .addOption("created-date", "Created date")
            .addOption("none", "Nothing")
            .setValue(this.plugin.settings.noteSecondaryLineMode)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.noteSecondaryLineMode = value;
            this.updateDateFormatPreview(noteDateFormatSetting, this.plugin.settings.noteDateFormat, this.plugin.settings.noteSecondaryLineMode);
            yield this.commit();
        })));
        noteDateFormatSetting = new Setting(containerEl)
            .setName("Note date format")
            .setDesc(this.createDateFormatDescription(this.plugin.settings.noteSecondaryLineMode))
            .addText((text) => text
            .setPlaceholder(DEFAULT_SETTINGS.noteDateFormat)
            .setValue(this.plugin.settings.noteDateFormat)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.noteDateFormat = value.trim() || DEFAULT_SETTINGS.noteDateFormat;
            this.updateDateFormatPreview(noteDateFormatSetting, this.plugin.settings.noteDateFormat, this.plugin.settings.noteSecondaryLineMode);
            yield this.commit();
        })));
        this.updateDateFormatPreview(noteDateFormatSetting, this.plugin.settings.noteDateFormat, this.plugin.settings.noteSecondaryLineMode);
        new Setting(containerEl)
            .setName("Underline pinned items")
            .setDesc("Underline pinned tags and notes using the current accent color.")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.underlinePinnedItems).onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.underlinePinnedItems = value;
            yield this.commit();
        })));
        new Setting(containerEl).setName("New notes").setHeading();
        let newNoteFolderText = null;
        new Setting(containerEl)
            .setName("New note folder")
            .setDesc("Folder used when creating a note from the selected tag; leave blank for the vault root.")
            .addText((text) => {
            newNoteFolderText = text;
            return text
                .setPlaceholder("Folder path")
                .setValue(this.plugin.settings.newNoteFolder)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.newNoteFolder = value.trim();
                yield this.commit();
            }));
        });
        if (newNoteFolderText) {
            this.folderPathSuggest = new FolderPathSuggest(this.app, newNoteFolderText, (value) => {
                this.plugin.settings.newNoteFolder = value;
                void this.commit();
            });
        }
        new Setting(containerEl).setName("Inbox").setHeading();
        new Setting(containerEl)
            .setName("Show inbox")
            .setDesc("Show a special pseudo-tag containing notes without tags.")
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.showUntagged).onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.showUntagged = value;
            yield this.commit({ rebuildIndex: true });
        })));
        new Setting(containerEl)
            .setName("Inbox label")
            .setDesc("Choose the label displayed for untagged notes.")
            .addText((text) => text
            .setPlaceholder("Inbox")
            .setValue(this.plugin.settings.untaggedLabel)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.untaggedLabel = value.trim() || DEFAULT_SETTINGS.untaggedLabel;
            yield this.commit({ rebuildIndex: true });
        })));
        new Setting(containerEl)
            .setName("Inbox position")
            .setDesc("Choose where the inbox pseudo-tag appears in the tree.")
            .addDropdown((dropdown) => dropdown
            .addOption("top", "Top")
            .addOption("bottom", "Bottom")
            .setValue(this.plugin.settings.untaggedPosition)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.untaggedPosition = value;
            yield this.commit({ rebuildIndex: true });
        })));
    }
    commit(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.plugin.saveSettings();
            if (options === null || options === void 0 ? void 0 : options.rebuildIndex) {
                yield this.plugin.rebuildIndexAndRefresh();
                return;
            }
            this.plugin.refreshViews();
        });
    }
    createDateFormatDescription(mode) {
        const fragment = document.createDocumentFragment();
        fragment.append(`Format the ${this.getSecondaryLineLabel(mode)} using Moment.js syntax. For more syntax, refer to `);
        const link = document.createElement("a");
        link.href = "https://momentjs.com/docs/#/displaying/format/";
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Format reference";
        fragment.append(link);
        fragment.append(".");
        return fragment;
    }
    updateDateFormatPreview(setting, format, mode) {
        const previewFormat = format.trim() || DEFAULT_SETTINGS.noteDateFormat;
        setting.setDesc(this.createDateFormatDescription(mode));
        let previewEl = setting.descEl.querySelector(".urso-setting-preview");
        if (!previewEl) {
            previewEl = setting.descEl.createDiv({ cls: ["setting-item-description", "urso-setting-preview"] });
        }
        if (mode === "none") {
            previewEl.setText("The secondary line is currently hidden.");
            return;
        }
        previewEl.setText(`Your current syntax looks like this: ${moment().format(previewFormat)} (${this.getSecondaryLineLabel(mode)})`);
    }
    getSecondaryLineLabel(mode) {
        switch (mode) {
            case "created-date":
                return "created date";
            case "updated-date":
                return "updated date";
            case "none":
                return "secondary line";
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFPLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQWlCLE1BQU0sVUFBVSxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzFELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUV0RCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUdwRSxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBdUI7SUFDbkQsVUFBVSxFQUFFLEVBQUU7SUFDZCxlQUFlLEVBQUUsbUJBQW1CO0lBQ3BDLFdBQVcsRUFBRSxFQUFFO0lBQ2YsZ0JBQWdCLEVBQUUsRUFBRTtJQUNwQixVQUFVLEVBQUUsRUFBRTtJQUNkLGFBQWEsRUFBRSxFQUFFO0lBQ2pCLGNBQWMsRUFBRSxRQUFRO0lBQ3hCLFNBQVMsRUFBRSxFQUFFO0lBQ2IscUJBQXFCLEVBQUUsY0FBYztJQUNyQyxjQUFjLEVBQUUsY0FBYztJQUM5QixlQUFlLEVBQUUsTUFBTTtJQUN2QixhQUFhLEVBQUUsRUFBRTtJQUNqQixjQUFjLEVBQUUsR0FBRztJQUNuQixVQUFVLEVBQUUsSUFBSTtJQUNoQixpQkFBaUIsRUFBRSxFQUFFO0lBQ3JCLFFBQVEsRUFBRSxFQUFFO0lBQ1osWUFBWSxFQUFFLElBQUk7SUFDbEIsb0JBQW9CLEVBQUUsSUFBSTtJQUMxQixhQUFhLEVBQUUsT0FBTztJQUN0QixnQkFBZ0IsRUFBRSxLQUFLO0lBQ3ZCLHVCQUF1QixFQUFFLEtBQUs7Q0FDOUIsQ0FBQztBQUVGLE1BQU0sT0FBTyxjQUFlLFNBQVEsZ0JBQWdCO0lBSW5ELFlBQVksR0FBUSxFQUFFLE1BQWtCO1FBQ3ZDLEtBQUssQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFIWixzQkFB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QixLQUFLLGNBQWM7Z0JBQ2xCLE9BQU8sY0FBYyxDQUFDO1lBQ3ZCLEtBQUssTUFBTTtnQkFDVixPQUFPLGdCQUFnQixDQUFDO1FBQzFCLENBQUM7SUFDRixDQUFDO0NBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIG1vbWVudCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVGV4dENvbXBvbmVudCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgRm9sZGVyUGF0aFN1Z2dlc3QgfSBmcm9tIFwiLi9mb2xkZXItcGF0aC1zdWdnZXN0XCI7XG5pbXBvcnQgeyBIaWRkZW5UYWdzTW9kYWwgfSBmcm9tIFwiLi9oaWRkZW4tdGFncy1tb2RhbFwiO1xuaW1wb3J0IHR5cGUgVXJzb1BsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgeyBUcmFja2VkUHJvcGVydGllc01vZGFsIH0gZnJvbSBcIi4vdHJhY2tlZC1wcm9wZXJ0aWVzLW1vZGFsXCI7XG5pbXBvcnQgeyBVcnNvUGx1Z2luU2V0dGluZ3MgfSBmcm9tIFwiLi9tb2RlbHNcIjtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFVyc29QbHVnaW5TZXR0aW5ncyA9IHtcblx0aGlkZGVuVGFnczogW10sXG5cdGluaGVyaXRhbmNlTW9kZTogXCJpbmNsdWRlLWFuY2VzdG9yc1wiLFxuXHRwaW5uZWROb3Rlczoge30sXG5cdHBpbm5lZFByb3BlcnRpZXM6IFtdLFxuXHRwaW5uZWRUYWdzOiBbXSxcblx0bmV3Tm90ZUZvbGRlcjogXCJcIixcblx0bm90ZURhdGVGb3JtYXQ6IFwiTU1NTSBEXCIsXG5cdG5vdGVJY29uczoge30sXG5cdG5vdGVTZWNvbmRhcnlMaW5lTW9kZTogXCJ1cGRhdGVkLWRhdGVcIixcblx0bm90ZXNTb3J0T3JkZXI6IFwidXBkYXRlZC1kZXNjXCIsXG5cdHByaW1hcnlWaWV3TW9kZTogXCJ0YWdzXCIsXG5cdHByb3BlcnR5SWNvbnM6IHt9LFxuXHRzcGxpdFBhbmVSYXRpbzogMC40LFxuXHRzaG93Q291bnRzOiB0cnVlLFxuXHR0cmFja2VkUHJvcGVydGllczogW10sXG5cdHRhZ0ljb25zOiB7fSxcblx0c2hvd1VudGFnZ2VkOiB0cnVlLFxuXHR1bmRlcmxpbmVQaW5uZWRJdGVtczogdHJ1ZSxcblx0dW50YWdnZWRMYWJlbDogXCJJbmJveFwiLFxuXHR1bnRhZ2dlZFBvc2l0aW9uOiBcInRvcFwiLFxuXHR1c2VNb2JpbGVMYXlvdXRPblRhYmxldDogZmFsc2UsXG59O1xuXG5leHBvcnQgY2xhc3MgVXJzb1NldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcblx0cGx1Z2luOiBVcnNvUGx1Z2luO1xuXHRwcml2YXRlIGZvbGRlclBhdGhTdWdnZXN0OiBGb2xkZXJQYXRoU3VnZ2VzdCB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IFVyc29QbHVnaW4pIHtcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblx0XHR0aGlzLmZvbGRlclBhdGhTdWdnZXN0Py5jbG9zZSgpO1xuXHRcdHRoaXMuZm9sZGVyUGF0aFN1Z2dlc3QgPSBudWxsO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJMYXlvdXRcIikuc2V0SGVhZGluZygpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlVzZSBtb2JpbGUgbGF5b3V0IG9uIHRhYmxldFwiKVxuXHRcdFx0LnNldERlc2MoXCJPbmx5IGFmZmVjdHMgdGFibGV0cy4gU2hvdyBvbmUgcGFuZSBhdCBhIHRpbWUgbGlrZSBwaG9uZXMgaW5zdGVhZCBvZiB0aGUgc3BsaXQgdmlldy5cIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnVzZU1vYmlsZUxheW91dE9uVGFibGV0KS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy51c2VNb2JpbGVMYXlvdXRPblRhYmxldCA9IHZhbHVlO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWl0KCk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiVGFnIHRyZWVcIikuc2V0SGVhZGluZygpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkluaGVyaXRhbmNlIG1vZGVcIilcblx0XHRcdC5zZXREZXNjKFwiQ2hvb3NlIHdoZXRoZXIgbm90ZXMgdGFnZ2VkIHdpdGggbmVzdGVkIHRhZ3MgYWxzbyBhcHBlYXIgaW4gdGhlaXIgcGFyZW50IHRhZ3MuXCIpXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuXHRcdFx0XHRkcm9wZG93blxuXHRcdFx0XHRcdC5hZGRPcHRpb24oXCJpbmNsdWRlLWFuY2VzdG9yc1wiLCBcIkluY2x1ZGUgcGFyZW50IHRhZ3NcIilcblx0XHRcdFx0XHQuYWRkT3B0aW9uKFwibGVhZi1vbmx5XCIsIFwiT25seSBtb3N0IHNwZWNpZmljIHRhZ1wiKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmhlcml0YW5jZU1vZGUpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5oZXJpdGFuY2VNb2RlID0gdmFsdWUgYXMgVXJzb1BsdWdpblNldHRpbmdzW1wiaW5oZXJpdGFuY2VNb2RlXCJdO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21taXQoeyByZWJ1aWxkSW5kZXg6IHRydWUgfSk7XG5cdFx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlNob3cgY291bnRzXCIpXG5cdFx0XHQuc2V0RGVzYyhcIkRpc3BsYXkgdGhlIG51bWJlciBvZiBtYXRjaGluZyBub3RlcyBiZXNpZGUgZWFjaCB0YWcuXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG5cdFx0XHRcdHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Q291bnRzKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Q291bnRzID0gdmFsdWU7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21taXQoKTtcblx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkhpZGRlbiB0YWdzXCIpXG5cdFx0XHQuc2V0RGVzYyhcIk1hbmFnZSB0YWdzIHRoYXQgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSB0aGUgZXhwbG9yZXIgdHJlZS5cIilcblx0XHRcdC5hZGRCdXR0b24oKGJ1dHRvbikgPT5cblx0XHRcdFx0YnV0dG9uLnNldEJ1dHRvblRleHQoXCJNYW5hZ2VcIikub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0bmV3IEhpZGRlblRhZ3NNb2RhbCh0aGlzLmFwcCwgdGhpcy5wbHVnaW4pLm9wZW4oKTtcblx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJQcm9wZXJ0aWVzXCIpLnNldEhlYWRpbmcoKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJUcmFja2VkIHByb3BlcnRpZXNcIilcblx0XHRcdC5zZXREZXNjKFwiQ2hvb3NlIHdoaWNoIHByb3BlcnRpZXMgYXBwZWFyIGluIHRoZSBleHBsb3JlciBhbmQgd2hldGhlciB0aGV5IGdyb3VwIG5vdGVzIGJ5IHZhbHVlLlwiKVxuXHRcdFx0LmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxuXHRcdFx0XHRidXR0b24uc2V0QnV0dG9uVGV4dChcIk1hbmFnZVwiKS5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHRuZXcgVHJhY2tlZFByb3BlcnRpZXNNb2RhbCh0aGlzLmFwcCwgdGhpcy5wbHVnaW4pLm9wZW4oKTtcblx0XHRcdFx0fSksXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJOb3RlcyBsaXN0XCIpLnNldEhlYWRpbmcoKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJTb3J0IG5vdGVzIGJ5XCIpXG5cdFx0XHQuc2V0RGVzYyhcIkNob29zZSBob3cgbm90ZXMgYXJlIG9yZGVyZWQgaW5zaWRlIGVhY2ggdGFnLlwiKVxuXHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cblx0XHRcdFx0ZHJvcGRvd25cblx0XHRcdFx0XHQuYWRkT3B0aW9uKFwidXBkYXRlZC1kZXNjXCIsIFwiTGFzdCB1cGRhdGVkXCIpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbihcInVwZGF0ZWQtYXNjXCIsIFwiRmlyc3QgdXBkYXRlZFwiKVxuXHRcdFx0XHRcdC5hZGRPcHRpb24oXCJjcmVhdGVkLWRlc2NcIiwgXCJMYXN0IGNyZWF0ZWRcIilcblx0XHRcdFx0XHQuYWRkT3B0aW9uKFwiY3JlYXRlZC1hc2NcIiwgXCJGaXJzdCBjcmVhdGVkXCIpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbihcInRpdGxlLWFzY1wiLCBcIlRpdGxlXCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVzU29ydE9yZGVyKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVzU29ydE9yZGVyID0gdmFsdWUgYXMgVXJzb1BsdWdpblNldHRpbmdzW1wibm90ZXNTb3J0T3JkZXJcIl07XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1pdCgpO1xuXHRcdFx0XHRcdH0pLFxuXHRcdFx0KTtcblxuXHRcdGxldCBub3RlRGF0ZUZvcm1hdFNldHRpbmchOiBTZXR0aW5nO1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJTZWNvbmRhcnkgbGluZVwiKVxuXHRcdFx0LnNldERlc2MoXCJDaG9vc2Ugd2hldGhlciB0aGUgbm90ZXMgbGlzdCBzaG93cyB0aGUgY3JlYXRlZCBkYXRlLCB1cGRhdGVkIGRhdGUsIG9yIG5vdGhpbmcuXCIpXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuXHRcdFx0XHRkcm9wZG93blxuXHRcdFx0XHRcdC5hZGRPcHRpb24oXCJ1cGRhdGVkLWRhdGVcIiwgXCJVcGRhdGVkIGRhdGVcIilcblx0XHRcdFx0XHQuYWRkT3B0aW9uKFwiY3JlYXRlZC1kYXRlXCIsIFwiQ3JlYXRlZCBkYXRlXCIpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbihcIm5vbmVcIiwgXCJOb3RoaW5nXCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVTZWNvbmRhcnlMaW5lTW9kZSlcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlU2Vjb25kYXJ5TGluZU1vZGUgPSB2YWx1ZSBhcyBVcnNvUGx1Z2luU2V0dGluZ3NbXCJub3RlU2Vjb25kYXJ5TGluZU1vZGVcIl07XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZURhdGVGb3JtYXRQcmV2aWV3KFxuXHRcdFx0XHRcdFx0XHRub3RlRGF0ZUZvcm1hdFNldHRpbmcsXG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRm9ybWF0LFxuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlU2Vjb25kYXJ5TGluZU1vZGUsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21taXQoKTtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cblx0XHRub3RlRGF0ZUZvcm1hdFNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiTm90ZSBkYXRlIGZvcm1hdFwiKVxuXHRcdFx0LnNldERlc2ModGhpcy5jcmVhdGVEYXRlRm9ybWF0RGVzY3JpcHRpb24odGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVNlY29uZGFyeUxpbmVNb2RlKSlcblx0XHRcdC5hZGRUZXh0KCh0ZXh0KSA9PlxuXHRcdFx0XHR0ZXh0XG5cdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKERFRkFVTFRfU0VUVElOR1Mubm90ZURhdGVGb3JtYXQpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRm9ybWF0KVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRm9ybWF0ID0gdmFsdWUudHJpbSgpIHx8IERFRkFVTFRfU0VUVElOR1Mubm90ZURhdGVGb3JtYXQ7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZURhdGVGb3JtYXRQcmV2aWV3KFxuXHRcdFx0XHRcdFx0XHRub3RlRGF0ZUZvcm1hdFNldHRpbmcsXG5cdFx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRm9ybWF0LFxuXHRcdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlU2Vjb25kYXJ5TGluZU1vZGUsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21taXQoKTtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cdFx0dGhpcy51cGRhdGVEYXRlRm9ybWF0UHJldmlldyhcblx0XHRcdG5vdGVEYXRlRm9ybWF0U2V0dGluZyxcblx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRm9ybWF0LFxuXHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVNlY29uZGFyeUxpbmVNb2RlLFxuXHRcdCk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiVW5kZXJsaW5lIHBpbm5lZCBpdGVtc1wiKVxuXHRcdFx0LnNldERlc2MoXCJVbmRlcmxpbmUgcGlubmVkIHRhZ3MgYW5kIG5vdGVzIHVzaW5nIHRoZSBjdXJyZW50IGFjY2VudCBjb2xvci5cIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnVuZGVybGluZVBpbm5lZEl0ZW1zKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy51bmRlcmxpbmVQaW5uZWRJdGVtcyA9IHZhbHVlO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWl0KCk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiTmV3IG5vdGVzXCIpLnNldEhlYWRpbmcoKTtcblxuXHRcdGxldCBuZXdOb3RlRm9sZGVyVGV4dDogVGV4dENvbXBvbmVudCB8IG51bGwgPSBudWxsO1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJOZXcgbm90ZSBmb2xkZXJcIilcblx0XHRcdC5zZXREZXNjKFwiRm9sZGVyIHVzZWQgd2hlbiBjcmVhdGluZyBhIG5vdGUgZnJvbSB0aGUgc2VsZWN0ZWQgdGFnOyBsZWF2ZSBibGFuayBmb3IgdGhlIHZhdWx0IHJvb3QuXCIpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT4ge1xuXHRcdFx0XHRuZXdOb3RlRm9sZGVyVGV4dCA9IHRleHQ7XG5cdFx0XHRcdHJldHVybiB0ZXh0XG5cdFx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKFwiRm9sZGVyIHBhdGhcIilcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubmV3Tm90ZUZvbGRlcilcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5uZXdOb3RlRm9sZGVyID0gdmFsdWUudHJpbSgpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21taXQoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdGlmIChuZXdOb3RlRm9sZGVyVGV4dCkge1xuXHRcdFx0dGhpcy5mb2xkZXJQYXRoU3VnZ2VzdCA9IG5ldyBGb2xkZXJQYXRoU3VnZ2VzdCh0aGlzLmFwcCwgbmV3Tm90ZUZvbGRlclRleHQsICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5uZXdOb3RlRm9sZGVyID0gdmFsdWU7XG5cdFx0XHRcdHZvaWQgdGhpcy5jb21taXQoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiSW5ib3hcIikuc2V0SGVhZGluZygpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlNob3cgaW5ib3hcIilcblx0XHRcdC5zZXREZXNjKFwiU2hvdyBhIHNwZWNpYWwgcHNldWRvLXRhZyBjb250YWluaW5nIG5vdGVzIHdpdGhvdXQgdGFncy5cIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dVbnRhZ2dlZCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd1VudGFnZ2VkID0gdmFsdWU7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21taXQoeyByZWJ1aWxkSW5kZXg6IHRydWUgfSk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJJbmJveCBsYWJlbFwiKVxuXHRcdFx0LnNldERlc2MoXCJDaG9vc2UgdGhlIGxhYmVsIGRpc3BsYXllZCBmb3IgdW50YWdnZWQgbm90ZXMuXCIpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcihcIkluYm94XCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnVudGFnZ2VkTGFiZWwpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudW50YWdnZWRMYWJlbCA9IHZhbHVlLnRyaW0oKSB8fCBERUZBVUxUX1NFVFRJTkdTLnVudGFnZ2VkTGFiZWw7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1pdCh7IHJlYnVpbGRJbmRleDogdHJ1ZSB9KTtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiSW5ib3ggcG9zaXRpb25cIilcblx0XHRcdC5zZXREZXNjKFwiQ2hvb3NlIHdoZXJlIHRoZSBpbmJveCBwc2V1ZG8tdGFnIGFwcGVhcnMgaW4gdGhlIHRyZWUuXCIpXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxuXHRcdFx0XHRkcm9wZG93blxuXHRcdFx0XHRcdC5hZGRPcHRpb24oXCJ0b3BcIiwgXCJUb3BcIilcblx0XHRcdFx0XHQuYWRkT3B0aW9uKFwiYm90dG9tXCIsIFwiQm90dG9tXCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnVudGFnZ2VkUG9zaXRpb24pXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudW50YWdnZWRQb3NpdGlvbiA9IHZhbHVlIGFzIFVyc29QbHVnaW5TZXR0aW5nc1tcInVudGFnZ2VkUG9zaXRpb25cIl07XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1pdCh7IHJlYnVpbGRJbmRleDogdHJ1ZSB9KTtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbW1pdChvcHRpb25zPzogeyByZWJ1aWxkSW5kZXg/OiBib29sZWFuIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblxuXHRcdGlmIChvcHRpb25zPy5yZWJ1aWxkSW5kZXgpIHtcblx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnJlYnVpbGRJbmRleEFuZFJlZnJlc2goKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnBsdWdpbi5yZWZyZXNoVmlld3MoKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRGF0ZUZvcm1hdERlc2NyaXB0aW9uKG1vZGU6IFVyc29QbHVnaW5TZXR0aW5nc1tcIm5vdGVTZWNvbmRhcnlMaW5lTW9kZVwiXSk6IERvY3VtZW50RnJhZ21lbnQge1xuXHRcdGNvbnN0IGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXHRcdGZyYWdtZW50LmFwcGVuZChcblx0XHRcdGBGb3JtYXQgdGhlICR7dGhpcy5nZXRTZWNvbmRhcnlMaW5lTGFiZWwobW9kZSl9IHVzaW5nIE1vbWVudC5qcyBzeW50YXguIEZvciBtb3JlIHN5bnRheCwgcmVmZXIgdG8gYCxcblx0XHQpO1xuXG5cdFx0Y29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xuXHRcdGxpbmsuaHJlZiA9IFwiaHR0cHM6Ly9tb21lbnRqcy5jb20vZG9jcy8jL2Rpc3BsYXlpbmcvZm9ybWF0L1wiO1xuXHRcdGxpbmsudGFyZ2V0ID0gXCJfYmxhbmtcIjtcblx0XHRsaW5rLnJlbCA9IFwibm9vcGVuZXJcIjtcblx0XHRsaW5rLnRleHRDb250ZW50ID0gXCJGb3JtYXQgcmVmZXJlbmNlXCI7XG5cdFx0ZnJhZ21lbnQuYXBwZW5kKGxpbmspO1xuXG5cdFx0ZnJhZ21lbnQuYXBwZW5kKFwiLlwiKTtcblx0XHRyZXR1cm4gZnJhZ21lbnQ7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZURhdGVGb3JtYXRQcmV2aWV3KFxuXHRcdHNldHRpbmc6IFNldHRpbmcsXG5cdFx0Zm9ybWF0OiBzdHJpbmcsXG5cdFx0bW9kZTogVXJzb1BsdWdpblNldHRpbmdzW1wibm90ZVNlY29uZGFyeUxpbmVNb2RlXCJdLFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBwcmV2aWV3Rm9ybWF0ID0gZm9ybWF0LnRyaW0oKSB8fCBERUZBVUxUX1NFVFRJTkdTLm5vdGVEYXRlRm9ybWF0O1xuXHRcdHNldHRpbmcuc2V0RGVzYyh0aGlzLmNyZWF0ZURhdGVGb3JtYXREZXNjcmlwdGlvbihtb2RlKSk7XG5cdFx0bGV0IHByZXZpZXdFbCA9IHNldHRpbmcuZGVzY0VsLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFwiLnVyc28tc2V0dGluZy1wcmV2aWV3XCIpO1xuXHRcdGlmICghcHJldmlld0VsKSB7XG5cdFx0XHRwcmV2aWV3RWwgPSBzZXR0aW5nLmRlc2NFbC5jcmVhdGVEaXYoeyBjbHM6IFtcInNldHRpbmctaXRlbS1kZXNjcmlwdGlvblwiLCBcInVyc28tc2V0dGluZy1wcmV2aWV3XCJdIH0pO1xuXHRcdH1cblxuXHRcdGlmIChtb2RlID09PSBcIm5vbmVcIikge1xuXHRcdFx0cHJldmlld0VsLnNldFRleHQoXCJUaGUgc2Vjb25kYXJ5IGxpbmUgaXMgY3VycmVudGx5IGhpZGRlbi5cIik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cHJldmlld0VsLnNldFRleHQoXG5cdFx0XHRgWW91ciBjdXJyZW50IHN5bnRheCBsb29rcyBsaWtlIHRoaXM6ICR7bW9tZW50KCkuZm9ybWF0KHByZXZpZXdGb3JtYXQpfSAoJHt0aGlzLmdldFNlY29uZGFyeUxpbmVMYWJlbChtb2RlKX0pYCxcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZWNvbmRhcnlMaW5lTGFiZWwobW9kZTogVXJzb1BsdWdpblNldHRpbmdzW1wibm90ZVNlY29uZGFyeUxpbmVNb2RlXCJdKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKG1vZGUpIHtcblx0XHRcdGNhc2UgXCJjcmVhdGVkLWRhdGVcIjpcblx0XHRcdFx0cmV0dXJuIFwiY3JlYXRlZCBkYXRlXCI7XG5cdFx0XHRjYXNlIFwidXBkYXRlZC1kYXRlXCI6XG5cdFx0XHRcdHJldHVybiBcInVwZGF0ZWQgZGF0ZVwiO1xuXHRcdFx0Y2FzZSBcIm5vbmVcIjpcblx0XHRcdFx0cmV0dXJuIFwic2Vjb25kYXJ5IGxpbmVcIjtcblx0XHR9XG5cdH1cbn1cbiJdfQ==