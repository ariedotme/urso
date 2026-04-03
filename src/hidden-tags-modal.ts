import {
	AbstractInputSuggest,
	App,
	ButtonComponent,
	Modal,
	Notice,
	setIcon,
	Setting,
	TextComponent,
} from "obsidian";
import type UrsoPlugin from "./main";

interface HiddenTagSuggestion {
	tagKey: string;
}

class HiddenTagSuggest extends AbstractInputSuggest<HiddenTagSuggestion> {
	constructor(
		app: App,
		private readonly text: TextComponent,
		private readonly getTagKeys: () => string[],
		private readonly onChooseTag: (tagKey: string) => void,
	) {
		super(app, text.inputEl);
	}

	getSuggestions(query: string): HiddenTagSuggestion[] {
		const normalizedQuery = query.trim().toLowerCase();
		const startsWithMatches: HiddenTagSuggestion[] = [];
		const includesMatches: HiddenTagSuggestion[] = [];

		for (const tagKey of this.getTagKeys()) {
			const normalizedTagKey = tagKey.toLowerCase();
			const suggestion = { tagKey };

			if (!normalizedQuery || normalizedTagKey.startsWith(normalizedQuery)) {
				startsWithMatches.push(suggestion);
				continue;
			}

			if (normalizedTagKey.includes(normalizedQuery)) {
				includesMatches.push(suggestion);
			}
		}

		return [...startsWithMatches, ...includesMatches];
	}

	renderSuggestion(value: HiddenTagSuggestion, el: HTMLElement): void {
		el.createDiv({ text: value.tagKey });
	}

	selectSuggestion(value: HiddenTagSuggestion): void {
		this.text.setValue(value.tagKey);
		this.onChooseTag(value.tagKey);
		this.close();
	}
}

class HiddenTagEditorModal extends Modal {
	private tagKey = "";
	private input: TextComponent | null = null;
	private suggest: HiddenTagSuggest | null = null;

	constructor(
		app: App,
		private readonly plugin: UrsoPlugin,
		private readonly options: {
			initialValue?: string;
			onSaved: () => void;
		},
	) {
		super(app);
		this.tagKey = options.initialValue ?? "";
	}

	onOpen(): void {
		this.setTitle(this.options.initialValue ? "Edit hidden tag" : "Add hidden tag");
		this.modalEl.addClass("urso-hidden-tags-modal");

		const wrapper = this.contentEl.createDiv({ cls: "urso-hidden-tags-editor" });
		wrapper.createDiv({
			cls: "setting-item-description",
			text: "Hidden tags are blacklisted from the tag tree, even if they do not currently exist in the vault.",
		});

		new Setting(wrapper)
			.setName("Tag name")
			.setDesc("Use an existing tag or type a tag path to keep hidden.")
			.addText((text) => {
				this.input = text;
				text.setPlaceholder("Tag name").setValue(this.tagKey).onChange((value) => {
					this.tagKey = value.trim();
				});

				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void this.save();
					}
				});

				return text;
			});

		if (this.input) {
			this.suggest = new HiddenTagSuggest(
				this.app,
				this.input,
				() => this.getAvailableTagKeys(),
				(tagKey) => {
					this.tagKey = tagKey;
				},
			);
		}

		const actions = wrapper.createDiv({ cls: "urso-hidden-tags-editor-actions" });
		const saveButton = new ButtonComponent(actions);
		saveButton.setButtonText(this.options.initialValue ? "Save" : "Add");
		saveButton.setCta();
		saveButton.onClick(() => {
			void this.save();
		});
	}

	onClose(): void {
		this.suggest?.close();
		this.suggest = null;
		this.contentEl.empty();
	}

	private getAvailableTagKeys(): string[] {
		const hiddenTags = new Set(this.plugin.getHiddenTags());
		if (this.options.initialValue) {
			hiddenTags.delete(this.options.initialValue);
		}

		return this.plugin.getManageableTagKeys().filter((tagKey) => !hiddenTags.has(tagKey));
	}

	private async save(): Promise<void> {
		if (!this.tagKey) {
			new Notice("Enter a tag name.");
			return;
		}

		const didSave = await this.plugin.upsertHiddenTag(this.tagKey, this.options.initialValue);
		if (!didSave) {
			return;
		}

		this.options.onSaved();
		this.close();
	}
}

export class HiddenTagsModal extends Modal {
	private listEl: HTMLElement | null = null;

	constructor(app: App, private readonly plugin: UrsoPlugin) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Hidden tags");
		this.modalEl.addClass("urso-hidden-tags-modal");

		const wrapper = this.contentEl.createDiv({ cls: "urso-hidden-tags-manager" });
		wrapper.createDiv({
			cls: "setting-item-description",
			text: "Hidden tags are blacklisted from the tag tree. They stay in this list even if the tag does not currently exist in your vault.",
		});

		const toolbar = wrapper.createDiv({ cls: "urso-hidden-tags-toolbar" });
		const addButton = new ButtonComponent(toolbar);
		addButton.setButtonText("Add tag");
		addButton.setCta();
		addButton.onClick(() => {
			this.openEditor();
		});

		this.listEl = wrapper.createDiv({ cls: "urso-hidden-tags-list" });
		this.renderHiddenTags();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderHiddenTags(): void {
		if (!this.listEl) {
			return;
		}

		this.listEl.empty();

		const hiddenTags = this.plugin.getHiddenTags();
		if (hiddenTags.length === 0) {
			this.listEl.createDiv({
				cls: "urso-hidden-tags-empty",
				text: "No hidden tags yet.",
			});
			return;
		}

		for (const tagKey of hiddenTags) {
			const item = this.listEl.createDiv({ cls: "urso-hidden-tags-item" });
			const details = item.createDiv({ cls: "urso-hidden-tags-details" });
			details.createDiv({ cls: "urso-hidden-tags-name", text: tagKey });
			details.createDiv({
				cls: "urso-hidden-tags-mode",
				text: "Hidden from the tag tree.",
			});

			const actions = item.createDiv({ cls: "urso-hidden-tags-actions" });

			const editButton = actions.createEl("button", {
				cls: ["clickable-icon", "urso-hidden-tags-action"],
				attr: {
					type: "button",
				},
			});
			setIcon(editButton, "pencil");
			editButton.setAttr("aria-label", `Edit ${tagKey}`);
			editButton.addEventListener("click", () => {
				this.openEditor(tagKey);
			});

			const removeButton = actions.createEl("button", {
				cls: ["clickable-icon", "urso-hidden-tags-action"],
				attr: {
					type: "button",
				},
			});
			setIcon(removeButton, "trash-2");
			removeButton.setAttr("aria-label", `Remove ${tagKey}`);
			removeButton.addEventListener("click", () => {
				void this.plugin.removeHiddenTag(tagKey).then(() => {
					this.renderHiddenTags();
				});
			});
		}
	}

	private openEditor(initialValue?: string): void {
		new HiddenTagEditorModal(this.app, this.plugin, {
			initialValue,
			onSaved: () => {
				this.renderHiddenTags();
			},
		}).open();
	}
}
