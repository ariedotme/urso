import { AbstractInputSuggest, App, ButtonComponent, Modal, Notice, setIcon, TextComponent } from "obsidian";
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
		this.text.setValue("");
		this.onChooseTag(value.tagKey);
		this.close();
	}
}

export class HiddenTagsModal extends Modal {
	private hiddenTagsEl: HTMLElement | null = null;
	private input: TextComponent | null = null;
	private suggest: HiddenTagSuggest | null = null;
	private query = "";

	constructor(app: App, private readonly plugin: UrsoPlugin) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Hidden tags");
		this.modalEl.addClass("urso-hidden-tags-modal");

		const wrapper = this.contentEl.createDiv({ cls: "urso-hidden-tags-manager" });
		wrapper.createDiv({
			cls: "setting-item-description",
			text: "Hidden tags are removed from the explorer tree until you unhide them here.",
		});

		const searchRow = wrapper.createDiv({ cls: "urso-hidden-tags-search-row" });
		const inputContainer = searchRow.createDiv({ cls: "urso-hidden-tags-search" });
		const input = new TextComponent(inputContainer);
		input.setPlaceholder("Search tags to hide");
		input.onChange((value) => {
			this.query = value.trim();
		});
		input.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void this.addFromQuery();
			}
		});
		this.input = input;

		const hideButton = new ButtonComponent(searchRow);
		hideButton.setButtonText("Hide");
		hideButton.onClick(() => {
			void this.addFromQuery();
		});

		this.suggest = new HiddenTagSuggest(this.app, input, () => this.getAvailableTagKeys(), (tagKey) => {
			void this.addHiddenTag(tagKey);
		});

		this.hiddenTagsEl = wrapper.createDiv({ cls: "urso-hidden-tags-list" });
		this.renderHiddenTags();

		window.setTimeout(() => {
			input.inputEl.focus();
			input.inputEl.select();
		}, 0);
	}

	onClose(): void {
		this.suggest?.close();
		this.suggest = null;
		this.contentEl.empty();
	}

	private getAvailableTagKeys(): string[] {
		const hiddenTags = new Set(this.plugin.settings.hiddenTags);
		return this.plugin.getManageableTagKeys().filter((tagKey) => !hiddenTags.has(tagKey));
	}

	private resolveTagFromQuery(query: string): string | null {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return null;
		}

		const availableTagKeys = this.getAvailableTagKeys();
		const exactMatch = availableTagKeys.find((tagKey) => tagKey.toLowerCase() === normalizedQuery);
		if (exactMatch) {
			return exactMatch;
		}

		const startsWithMatch = availableTagKeys.find((tagKey) => tagKey.toLowerCase().startsWith(normalizedQuery));
		if (startsWithMatch) {
			return startsWithMatch;
		}

		return availableTagKeys.find((tagKey) => tagKey.toLowerCase().includes(normalizedQuery)) ?? null;
	}

	private async addFromQuery(): Promise<void> {
		const tagKey = this.resolveTagFromQuery(this.query);
		if (!tagKey) {
			new Notice("No matching tag found.");
			return;
		}

		await this.addHiddenTag(tagKey);
	}

	private async addHiddenTag(tagKey: string): Promise<void> {
		await this.plugin.hideTag(tagKey);
		this.query = "";
		this.input?.setValue("");
		this.renderHiddenTags();
	}

	private renderHiddenTags(): void {
		if (!this.hiddenTagsEl) {
			return;
		}

		this.hiddenTagsEl.empty();

		const hiddenTags = [...this.plugin.settings.hiddenTags].sort((left, right) => left.localeCompare(right));
		if (hiddenTags.length === 0) {
			this.hiddenTagsEl.createDiv({
				cls: "urso-hidden-tags-empty",
				text: "No hidden tags.",
			});
			return;
		}

		for (const tagKey of hiddenTags) {
			const item = this.hiddenTagsEl.createDiv({ cls: "urso-hidden-tags-item" });
			item.createDiv({ cls: "urso-hidden-tags-name", text: tagKey });

			const removeButton = item.createEl("button", {
				cls: ["clickable-icon", "urso-hidden-tags-remove"],
				attr: {
					type: "button",
				},
			});
			setIcon(removeButton, "x");
			removeButton.setAttr("aria-label", `Unhide ${tagKey}`);
			removeButton.addEventListener("click", () => {
				void this.plugin.unhideTag(tagKey).then(() => {
					this.renderHiddenTags();
				});
			});
		}
	}
}
