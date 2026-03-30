import { App, ButtonComponent, getIconIds, Modal, setIcon, TextComponent } from "obsidian";

interface TagIconPickerModalOptions {
	currentIcon: string | null;
	onChoose: (iconName: string | null) => Promise<void>;
	tagLabel: string;
}

const MAX_ICON_RESULTS = 24;

export class TagIconPickerModal extends Modal {
	private readonly currentIcon: string | null;
	private readonly iconIds: string[];
	private readonly onChoose: (iconName: string | null) => Promise<void>;
	private readonly tagLabel: string;

	private query = "";
	private resultsEl: HTMLElement | null = null;

	constructor(app: App, options: TagIconPickerModalOptions) {
		super(app);
		this.currentIcon = options.currentIcon;
		this.iconIds = [...getIconIds()].sort((left, right) => left.localeCompare(right));
		this.onChoose = options.onChoose;
		this.tagLabel = options.tagLabel;
	}

	onOpen(): void {
		this.setTitle(`Icon for ${this.tagLabel}`);
		this.modalEl.addClass("urso-icon-picker-modal");

		const wrapper = this.contentEl.createDiv({ cls: "urso-icon-picker" });
		const searchRow = wrapper.createDiv({ cls: "urso-icon-picker-search-row" });
		const inputContainer = searchRow.createDiv({ cls: "urso-icon-picker-search" });
		const input = new TextComponent(inputContainer);
		input.setPlaceholder("Search icons");
		input.onChange((value) => {
			this.query = value.trim().toLowerCase();
			this.renderResults();
		});

		if (this.currentIcon) {
			const clearButton = new ButtonComponent(searchRow);
			clearButton.setButtonText("Clear");
			clearButton.onClick(() => {
				void this.chooseIcon(null);
			});
		}

		this.resultsEl = wrapper.createDiv({ cls: "urso-icon-picker-results" });
		this.renderResults();

		window.setTimeout(() => {
			input.inputEl.focus();
			input.inputEl.select();
		}, 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderResults(): void {
		if (!this.resultsEl) {
			return;
		}

		this.resultsEl.empty();

		const icons = this.getFilteredIcons();
		if (icons.length === 0) {
			this.resultsEl.createDiv({
				cls: "urso-icon-picker-empty",
				text: "No icons match that search.",
			});
			return;
		}

		for (const iconName of icons) {
			const button = this.resultsEl.createEl("button", {
				cls: [
					"urso-icon-picker-result",
					iconName === this.currentIcon ? "is-current" : "",
				],
				attr: {
					type: "button",
				},
			});

			const preview = button.createDiv({ cls: "urso-icon-picker-preview" });
			setIcon(preview, iconName);
			button.createDiv({ cls: "urso-icon-picker-name", text: iconName });

			button.addEventListener("click", () => {
				void this.chooseIcon(iconName);
			});
		}
	}

	private getFilteredIcons(): string[] {
		if (!this.query) {
			return this.iconIds.slice(0, MAX_ICON_RESULTS);
		}

		const startsWithMatches: string[] = [];
		const includesMatches: string[] = [];

		for (const iconName of this.iconIds) {
			const normalizedIconName = iconName.toLowerCase();
			if (normalizedIconName.startsWith(this.query)) {
				startsWithMatches.push(iconName);
				continue;
			}

			if (normalizedIconName.includes(this.query)) {
				includesMatches.push(iconName);
			}
		}

		return [...startsWithMatches, ...includesMatches].slice(0, MAX_ICON_RESULTS);
	}

	private async chooseIcon(iconName: string | null): Promise<void> {
		await this.onChoose(iconName);
		this.close();
	}
}
