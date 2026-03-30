import { App, moment, PluginSettingTab, Setting, TextComponent } from "obsidian";
import { FolderPathSuggest } from "./folder-path-suggest";
import { HiddenTagsModal } from "./hidden-tags-modal";
import type UrsoPlugin from "./main";
import { TrackedPropertiesModal } from "./tracked-properties-modal";
import { UrsoPluginSettings } from "./models";

export const DEFAULT_SETTINGS: UrsoPluginSettings = {
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
	plugin: UrsoPlugin;
	private folderPathSuggest: FolderPathSuggest | null = null;

	constructor(app: App, plugin: UrsoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.folderPathSuggest?.close();
		this.folderPathSuggest = null;

		new Setting(containerEl).setName("Layout").setHeading();

		new Setting(containerEl)
			.setName("Use mobile layout on tablet")
			.setDesc("Only affects tablets. Show one pane at a time like phones instead of the split view.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useMobileLayoutOnTablet).onChange(async (value) => {
					this.plugin.settings.useMobileLayoutOnTablet = value;
					await this.commit();
				}),
			);

		new Setting(containerEl).setName("Tag tree").setHeading();

		new Setting(containerEl)
			.setName("Inheritance mode")
			.setDesc("Choose whether notes tagged with nested tags also appear in their parent tags.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("include-ancestors", "Include parent tags")
					.addOption("leaf-only", "Only most specific tag")
					.setValue(this.plugin.settings.inheritanceMode)
					.onChange(async (value) => {
						this.plugin.settings.inheritanceMode = value as UrsoPluginSettings["inheritanceMode"];
						await this.commit({ rebuildIndex: true });
					}),
			);

		new Setting(containerEl)
			.setName("Show counts")
			.setDesc("Display the number of matching notes beside each tag.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showCounts).onChange(async (value) => {
					this.plugin.settings.showCounts = value;
					await this.commit();
				}),
			);

		new Setting(containerEl)
			.setName("Hidden tags")
			.setDesc("Manage tags that should be removed from the explorer tree.")
			.addButton((button) =>
				button.setButtonText("Manage").onClick(() => {
					new HiddenTagsModal(this.app, this.plugin).open();
				}),
			);

		new Setting(containerEl).setName("Properties").setHeading();

		new Setting(containerEl)
			.setName("Tracked properties")
			.setDesc("Choose which properties appear in the explorer and whether they group notes by value.")
			.addButton((button) =>
				button.setButtonText("Manage").onClick(() => {
					new TrackedPropertiesModal(this.app, this.plugin).open();
				}),
			);

		new Setting(containerEl).setName("Notes list").setHeading();

		new Setting(containerEl)
			.setName("Sort notes by")
			.setDesc("Choose how notes are ordered inside each tag.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("updated-desc", "Last updated")
					.addOption("updated-asc", "First updated")
					.addOption("created-desc", "Last created")
					.addOption("created-asc", "First created")
					.addOption("title-asc", "Title")
					.setValue(this.plugin.settings.notesSortOrder)
					.onChange(async (value) => {
						this.plugin.settings.notesSortOrder = value as UrsoPluginSettings["notesSortOrder"];
						await this.commit();
					}),
			);

		let noteDateFormatSetting!: Setting;
		new Setting(containerEl)
			.setName("Secondary line")
			.setDesc("Choose whether the notes list shows the created date, updated date, or nothing.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("updated-date", "Updated date")
					.addOption("created-date", "Created date")
					.addOption("none", "Nothing")
					.setValue(this.plugin.settings.noteSecondaryLineMode)
					.onChange(async (value) => {
						this.plugin.settings.noteSecondaryLineMode = value as UrsoPluginSettings["noteSecondaryLineMode"];
						this.updateDateFormatPreview(
							noteDateFormatSetting,
							this.plugin.settings.noteDateFormat,
							this.plugin.settings.noteSecondaryLineMode,
						);
						await this.commit();
					}),
			);

		noteDateFormatSetting = new Setting(containerEl)
			.setName("Note date format")
			.setDesc(this.createDateFormatDescription(this.plugin.settings.noteSecondaryLineMode))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.noteDateFormat)
					.setValue(this.plugin.settings.noteDateFormat)
					.onChange(async (value) => {
						this.plugin.settings.noteDateFormat = value.trim() || DEFAULT_SETTINGS.noteDateFormat;
						this.updateDateFormatPreview(
							noteDateFormatSetting,
							this.plugin.settings.noteDateFormat,
							this.plugin.settings.noteSecondaryLineMode,
						);
						await this.commit();
					}),
			);
		this.updateDateFormatPreview(
			noteDateFormatSetting,
			this.plugin.settings.noteDateFormat,
			this.plugin.settings.noteSecondaryLineMode,
		);

		new Setting(containerEl)
			.setName("Underline pinned items")
			.setDesc("Underline pinned tags and notes using the current accent color.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.underlinePinnedItems).onChange(async (value) => {
					this.plugin.settings.underlinePinnedItems = value;
					await this.commit();
				}),
			);

		new Setting(containerEl).setName("New notes").setHeading();

		let newNoteFolderText: TextComponent | null = null;
		new Setting(containerEl)
			.setName("New note folder")
			.setDesc("Folder used when creating a note from the selected tag; leave blank for the vault root.")
			.addText((text) => {
				newNoteFolderText = text;
				return text
					.setPlaceholder("Folder path")
					.setValue(this.plugin.settings.newNoteFolder)
					.onChange(async (value) => {
						this.plugin.settings.newNoteFolder = value.trim();
						await this.commit();
					});
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
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showUntagged).onChange(async (value) => {
					this.plugin.settings.showUntagged = value;
					await this.commit({ rebuildIndex: true });
				}),
			);

		new Setting(containerEl)
			.setName("Inbox label")
			.setDesc("Choose the label displayed for untagged notes.")
			.addText((text) =>
				text
					.setPlaceholder("Inbox")
					.setValue(this.plugin.settings.untaggedLabel)
					.onChange(async (value) => {
						this.plugin.settings.untaggedLabel = value.trim() || DEFAULT_SETTINGS.untaggedLabel;
						await this.commit({ rebuildIndex: true });
					}),
			);

		new Setting(containerEl)
			.setName("Inbox position")
			.setDesc("Choose where the inbox pseudo-tag appears in the tree.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("top", "Top")
					.addOption("bottom", "Bottom")
					.setValue(this.plugin.settings.untaggedPosition)
					.onChange(async (value) => {
						this.plugin.settings.untaggedPosition = value as UrsoPluginSettings["untaggedPosition"];
						await this.commit({ rebuildIndex: true });
					}),
			);
	}

	private async commit(options?: { rebuildIndex?: boolean }): Promise<void> {
		await this.plugin.saveSettings();

		if (options?.rebuildIndex) {
			await this.plugin.rebuildIndexAndRefresh();
			return;
		}

		this.plugin.refreshViews();
	}

	private createDateFormatDescription(mode: UrsoPluginSettings["noteSecondaryLineMode"]): DocumentFragment {
		const fragment = document.createDocumentFragment();
		fragment.append(
			`Format the ${this.getSecondaryLineLabel(mode)} using Moment.js syntax. For more syntax, refer to `,
		);

		const link = document.createElement("a");
		link.href = "https://momentjs.com/docs/#/displaying/format/";
		link.target = "_blank";
		link.rel = "noopener";
		link.textContent = "Format reference";
		fragment.append(link);

		fragment.append(".");
		return fragment;
	}

	private updateDateFormatPreview(
		setting: Setting,
		format: string,
		mode: UrsoPluginSettings["noteSecondaryLineMode"],
	): void {
		const previewFormat = format.trim() || DEFAULT_SETTINGS.noteDateFormat;
		setting.setDesc(this.createDateFormatDescription(mode));
		let previewEl = setting.descEl.querySelector<HTMLElement>(".urso-setting-preview");
		if (!previewEl) {
			previewEl = setting.descEl.createDiv({ cls: ["setting-item-description", "urso-setting-preview"] });
		}

		if (mode === "none") {
			previewEl.setText("The secondary line is currently hidden.");
			return;
		}

		previewEl.setText(
			`Your current syntax looks like this: ${moment().format(previewFormat)} (${this.getSecondaryLineLabel(mode)})`,
		);
	}

	private getSecondaryLineLabel(mode: UrsoPluginSettings["noteSecondaryLineMode"]): string {
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
