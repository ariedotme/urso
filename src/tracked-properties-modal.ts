import {
	AbstractInputSuggest,
	App,
	ButtonComponent,
	DropdownComponent,
	Modal,
	Notice,
	setIcon,
	Setting,
	TextComponent,
} from "obsidian";
import type UrsoPlugin from "./main";
import { TrackedPropertyMode, TrackedPropertySetting } from "./models";

interface PropertyKeySuggestion {
	propertyKey: string;
}

class PropertyKeySuggest extends AbstractInputSuggest<PropertyKeySuggestion> {
	constructor(
		app: App,
		private readonly text: TextComponent,
		private readonly getPropertyKeys: () => string[],
		private readonly onChoosePropertyKey: (propertyKey: string) => void,
	) {
		super(app, text.inputEl);
	}

	getSuggestions(query: string): PropertyKeySuggestion[] {
		const normalizedQuery = query.trim().toLowerCase();
		const startsWithMatches: PropertyKeySuggestion[] = [];
		const includesMatches: PropertyKeySuggestion[] = [];

		for (const propertyKey of this.getPropertyKeys()) {
			const normalizedPropertyKey = propertyKey.toLowerCase();
			const suggestion = { propertyKey };

			if (!normalizedQuery || normalizedPropertyKey.startsWith(normalizedQuery)) {
				startsWithMatches.push(suggestion);
				continue;
			}

			if (normalizedPropertyKey.includes(normalizedQuery)) {
				includesMatches.push(suggestion);
			}
		}

		return [...startsWithMatches, ...includesMatches];
	}

	renderSuggestion(value: PropertyKeySuggestion, el: HTMLElement): void {
		el.createDiv({ text: value.propertyKey });
	}

	selectSuggestion(value: PropertyKeySuggestion): void {
		this.text.setValue(value.propertyKey);
		this.onChoosePropertyKey(value.propertyKey);
		this.close();
	}
}

class TrackedPropertyEditorModal extends Modal {
	private propertyKey = "";
	private mode: TrackedPropertyMode = "notes";
	private input: TextComponent | null = null;
	private suggest: PropertyKeySuggest | null = null;

	constructor(
		app: App,
		private readonly plugin: UrsoPlugin,
		private readonly options: {
			initialValue?: TrackedPropertySetting;
			onSaved: () => void;
		},
	) {
		super(app);
		this.propertyKey = options.initialValue?.propertyKey ?? "";
		this.mode = options.initialValue?.mode ?? "notes";
	}

	onOpen(): void {
		this.setTitle(this.options.initialValue ? "Edit tracked property" : "Add tracked property");
		this.modalEl.addClass("urso-tracked-properties-modal");

		const wrapper = this.contentEl.createDiv({ cls: "urso-tracked-properties-editor" });
		wrapper.createDiv({
			cls: "setting-item-description",
			text: "Choose a property name and whether Urso should show matching notes directly or group them by value.",
		});

		new Setting(wrapper)
			.setName("Property name")
			.setDesc("Use an existing property or enter a new one.")
			.addText((text) => {
				this.input = text;
				text.setPlaceholder("Property name").setValue(this.propertyKey).onChange((value) => {
					this.propertyKey = value.trim();
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
			this.suggest = new PropertyKeySuggest(
				this.app,
				this.input,
				() => this.plugin.getAvailablePropertyKeys(),
				(propertyKey) => {
					this.propertyKey = propertyKey;
				},
			);
		}

		new Setting(wrapper)
			.setName("Display mode")
			.setDesc("Either show all notes with that property or show sub-categories for each value.")
			.addDropdown((dropdown: DropdownComponent) =>
				dropdown
					.addOption("notes", "Show notes with that property")
					.addOption("values", "Show sub-categories for all values")
					.setValue(this.mode)
					.onChange((value) => {
						this.mode = value === "values" ? "values" : "notes";
					}),
			);

		const actions = wrapper.createDiv({ cls: "urso-tracked-properties-editor-actions" });
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

	private async save(): Promise<void> {
		if (!this.propertyKey) {
			new Notice("Enter a property name.");
			return;
		}

		const didSave = await this.plugin.upsertTrackedProperty(
			{
				propertyKey: this.propertyKey,
				mode: this.mode,
			},
			this.options.initialValue?.propertyKey,
		);
		if (!didSave) {
			return;
		}

		this.options.onSaved();
		this.close();
	}
}

export class TrackedPropertiesModal extends Modal {
	private listEl: HTMLElement | null = null;

	constructor(app: App, private readonly plugin: UrsoPlugin) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Tracked properties");
		this.modalEl.addClass("urso-tracked-properties-modal");

		const wrapper = this.contentEl.createDiv({ cls: "urso-tracked-properties-manager" });
		wrapper.createDiv({
			cls: "setting-item-description",
			text: "Tracked properties appear in the Properties view. Each property can either show matching notes directly or group those notes by value.",
		});

		const toolbar = wrapper.createDiv({ cls: "urso-tracked-properties-toolbar" });
		const addButton = new ButtonComponent(toolbar);
		addButton.setButtonText("Add property");
		addButton.setCta();
		addButton.onClick(() => {
			this.openEditor();
		});

		this.listEl = wrapper.createDiv({ cls: "urso-tracked-properties-list" });
		this.renderTrackedProperties();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderTrackedProperties(): void {
		if (!this.listEl) {
			return;
		}

		this.listEl.empty();

		const trackedProperties = this.plugin.getTrackedProperties();
		if (trackedProperties.length === 0) {
			this.listEl.createDiv({
				cls: "urso-tracked-properties-empty",
				text: "No tracked properties yet.",
			});
			return;
		}

		for (const trackedProperty of trackedProperties) {
			const item = this.listEl.createDiv({ cls: "urso-tracked-properties-item" });
			const details = item.createDiv({ cls: "urso-tracked-properties-details" });
			details.createDiv({
				cls: "urso-tracked-properties-name",
				text: trackedProperty.propertyKey,
			});
			details.createDiv({
				cls: "urso-tracked-properties-mode",
				text:
					trackedProperty.mode === "values"
						? "Show sub-categories for all values"
						: "Show notes with that property",
			});

			const actions = item.createDiv({ cls: "urso-tracked-properties-actions" });

			const editButton = actions.createEl("button", {
				cls: ["clickable-icon", "urso-tracked-properties-action"],
				attr: {
					type: "button",
				},
			});
			setIcon(editButton, "pencil");
			editButton.setAttr("aria-label", `Edit ${trackedProperty.propertyKey}`);
			editButton.addEventListener("click", () => {
				this.openEditor(trackedProperty);
			});

			const removeButton = actions.createEl("button", {
				cls: ["clickable-icon", "urso-tracked-properties-action"],
				attr: {
					type: "button",
				},
			});
			setIcon(removeButton, "trash-2");
			removeButton.setAttr("aria-label", `Remove ${trackedProperty.propertyKey}`);
			removeButton.addEventListener("click", () => {
				void this.plugin.removeTrackedProperty(trackedProperty.propertyKey).then(() => {
					this.renderTrackedProperties();
				});
			});
		}
	}

	private openEditor(initialValue?: TrackedPropertySetting): void {
		new TrackedPropertyEditorModal(this.app, this.plugin, {
			initialValue,
			onSaved: () => {
				this.renderTrackedProperties();
			},
		}).open();
	}
}
