import { __awaiter } from "tslib";
import { AbstractInputSuggest, ButtonComponent, Modal, Notice, setIcon, Setting, } from "obsidian";
class PropertyKeySuggest extends AbstractInputSuggest {
    constructor(app, text, getPropertyKeys, onChoosePropertyKey) {
        super(app, text.inputEl);
        this.text = text;
        this.getPropertyKeys = getPropertyKeys;
        this.onChoosePropertyKey = onChoosePropertyKey;
    }
    getSuggestions(query) {
        const normalizedQuery = query.trim().toLowerCase();
        const startsWithMatches = [];
        const includesMatches = [];
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
    renderSuggestion(value, el) {
        el.createDiv({ text: value.propertyKey });
    }
    selectSuggestion(value) {
        this.text.setValue(value.propertyKey);
        this.onChoosePropertyKey(value.propertyKey);
        this.close();
    }
}
class TrackedPropertyEditorModal extends Modal {
    constructor(app, plugin, options) {
        var _a, _b, _c, _d;
        super(app);
        this.plugin = plugin;
        this.options = options;
        this.propertyKey = "";
        this.mode = "notes";
        this.input = null;
        this.suggest = null;
        this.propertyKey = (_b = (_a = options.initialValue) === null || _a === void 0 ? void 0 : _a.propertyKey) !== null && _b !== void 0 ? _b : "";
        this.mode = (_d = (_c = options.initialValue) === null || _c === void 0 ? void 0 : _c.mode) !== null && _d !== void 0 ? _d : "notes";
    }
    onOpen() {
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
            this.suggest = new PropertyKeySuggest(this.app, this.input, () => this.plugin.getAvailablePropertyKeys(), (propertyKey) => {
                this.propertyKey = propertyKey;
            });
        }
        new Setting(wrapper)
            .setName("Display mode")
            .setDesc("Either show all notes with that property or show sub-categories for each value.")
            .addDropdown((dropdown) => dropdown
            .addOption("notes", "Show notes with that property")
            .addOption("values", "Show sub-categories for all values")
            .setValue(this.mode)
            .onChange((value) => {
            this.mode = value === "values" ? "values" : "notes";
        }));
        const actions = wrapper.createDiv({ cls: "urso-tracked-properties-editor-actions" });
        const saveButton = new ButtonComponent(actions);
        saveButton.setButtonText(this.options.initialValue ? "Save" : "Add");
        saveButton.setCta();
        saveButton.onClick(() => {
            void this.save();
        });
    }
    onClose() {
        var _a;
        (_a = this.suggest) === null || _a === void 0 ? void 0 : _a.close();
        this.suggest = null;
        this.contentEl.empty();
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.propertyKey) {
                new Notice("Enter a property name.");
                return;
            }
            const didSave = yield this.plugin.upsertTrackedProperty({
                propertyKey: this.propertyKey,
                mode: this.mode,
            }, (_a = this.options.initialValue) === null || _a === void 0 ? void 0 : _a.propertyKey);
            if (!didSave) {
                return;
            }
            this.options.onSaved();
            this.close();
        });
    }
}
export class TrackedPropertiesModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.listEl = null;
    }
    onOpen() {
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
    onClose() {
        this.contentEl.empty();
    }
    renderTrackedProperties() {
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
                text: trackedProperty.mode === "values"
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
    openEditor(initialValue) {
        new TrackedPropertyEditorModal(this.app, this.plugin, {
            initialValue,
            onSaved: () => {
                this.renderTrackedProperties();
            },
        }).open();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2tlZC1wcm9wZXJ0aWVzLW1vZGFsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidHJhY2tlZC1wcm9wZXJ0aWVzLW1vZGFsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPLEVBQ04sb0JBQW9CLEVBRXBCLGVBQWUsRUFFZixLQUFLLEVBQ0wsTUFBTSxFQUNOLE9BQU8sRUFDUCxPQUFPLEdBRVAsTUFBTSxVQUFVLENBQUM7QUFRbEIsTUFBTSxrQkFBbUIsU0FBUSxvQkFBMkM7SUFDM0UsWUFDQyxHQUFRLEVBQ1MsSUFBbUIsRUFDbkIsZUFBK0IsRUFDL0IsbUJBQWtEO1FBRW5FLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBSlIsU0FBSSxHQUFKLElBQUksQ0FBZTtRQUNuQixvQkFBZSxHQUFmLGVBQWUsQ0FBZ0I7UUFDL0Isd0JBQW1CLEdBQW5CLG1CQUFtQixDQUErQjtJQUdwRSxDQUFDO0lBRUQsY0FBYyxDQUFDLEtBQWE7UUFDM0IsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25ELE1BQU0saUJBQWlCLEdBQTRCLEVBQUUsQ0FBQztRQUN0RCxNQUFNLGVBQWUsR0FBNEIsRUFBRSxDQUFDO1FBRXBELEtBQUssTUFBTSxXQUFXLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUM7WUFDbEQsTUFBTSxxQkFBcUIsR0FBRyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDeEQsTUFBTSxVQUFVLEdBQUcsRUFBRSxXQUFXLEVBQUUsQ0FBQztZQUVuQyxJQUFJLENBQUMsZUFBZSxJQUFJLHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO2dCQUMzRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ25DLFNBQVM7WUFDVixDQUFDO1lBRUQsSUFBSSxxQkFBcUIsQ0FB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bnQiOlsiaW1wb3J0IHtcblx0QWJzdHJhY3RJbnB1dFN1Z2dlc3QsXG5cdEFwcCxcblx0QnV0dG9uQ29tcG9uZW50LFxuXHREcm9wZG93bkNvbXBvbmVudCxcblx0TW9kYWwsXG5cdE5vdGljZSxcblx0c2V0SWNvbixcblx0U2V0dGluZyxcblx0VGV4dENvbXBvbmVudCxcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBVcnNvUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IFRyYWNrZWRQcm9wZXJ0eU1vZGUsIFRyYWNrZWRQcm9wZXJ0eVNldHRpbmcgfSBmcm9tIFwiLi9tb2RlbHNcIjtcblxuaW50ZXJmYWNlIFByb3BlcnR5S2V5U3VnZ2VzdGlvbiB7XG5cdHByb3BlcnR5S2V5OiBzdHJpbmc7XG59XG5cbmNsYXNzIFByb3BlcnR5S2V5U3VnZ2VzdCBleHRlbmRzIEFic3RyYWN0SW5wdXRTdWdnZXN0PFByb3BlcnR5S2V5U3VnZ2VzdGlvbj4ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRhcHA6IEFwcCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRleHQ6IFRleHRDb21wb25lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBnZXRQcm9wZXJ0eUtleXM6ICgpID0+IHN0cmluZ1tdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb25DaG9vc2VQcm9wZXJ0eUtleTogKHByb3BlcnR5S2V5OiBzdHJpbmcpID0+IHZvaWQsXG5cdCkge1xuXHRcdHN1cGVyKGFwcCwgdGV4dC5pbnB1dEVsKTtcblx0fVxuXG5cdGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBQcm9wZXJ0eUtleVN1Z2dlc3Rpb25bXSB7XG5cdFx0Y29uc3Qgbm9ybWFsaXplZFF1ZXJ5ID0gcXVlcnkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cdFx0Y29uc3Qgc3RhcnRzV2l0aE1hdGNoZXM6IFByb3BlcnR5S2V5U3VnZ2VzdGlvbltdID0gW107XG5cdFx0Y29uc3QgaW5jbHVkZXNNYXRjaGVzOiBQcm9wZXJ0eUtleVN1Z2dlc3Rpb25bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBwcm9wZXJ0eUtleSBvZiB0aGlzLmdldFByb3BlcnR5S2V5cygpKSB7XG5cdFx0XHRjb25zdCBub3JtYWxpemVkUHJvcGVydHlLZXkgPSBwcm9wZXJ0eUtleS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0Y29uc3Qgc3VnZ2VzdGlvbiA9IHsgcHJvcGVydHlLZXkgfTtcblxuXHRcdFx0aWYgKCFub3JtYWxpemVkUXVlcnkgfHwgbm9ybWFsaXplZFByb3BlcnR5S2V5LnN0YXJ0c1dpdGgobm9ybWFsaXplZFF1ZXJ5KSkge1xuXHRcdFx0XHRzdGFydHNXaXRoTWF0Y2hlcy5wdXNoKHN1Z2dlc3Rpb24pO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG5vcm1hbGl6ZWRQcm9wZXJ0eUtleS5pbmNsdWRlcyhub3JtYWxpemVkUXVlcnkpKSB7XG5cdFx0XHRcdGluY2x1ZGVzTWF0Y2hlcy5wdXNoKHN1Z2dlc3Rpb24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBbLi4uc3RhcnRzV2l0aE1hdGNoZXMsIC4uLmluY2x1ZGVzTWF0Y2hlc107XG5cdH1cblxuXHRyZW5kZXJTdWdnZXN0aW9uKHZhbHVlOiBQcm9wZXJ0eUtleVN1Z2dlc3Rpb24sIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGVsLmNyZWF0ZURpdih7IHRleHQ6IHZhbHVlLnByb3BlcnR5S2V5IH0pO1xuXHR9XG5cblx0c2VsZWN0U3VnZ2VzdGlvbih2YWx1ZTogUHJvcGVydHlLZXlTdWdnZXN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy50ZXh0LnNldFZhbHVlKHZhbHVlLnByb3BlcnR5S2V5KTtcblx0XHR0aGlzLm9uQ2hvb3NlUHJvcGVydHlLZXkodmFsdWUucHJvcGVydHlLZXkpO1xuXHRcdHRoaXMuY2xvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBUcmFja2VkUHJvcGVydHlFZGl0b3JNb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBwcm9wZXJ0eUtleSA9IFwiXCI7XG5cdHByaXZhdGUgbW9kZTogVHJhY2tlZFByb3BlcnR5TW9kZSA9IFwibm90ZXNcIjtcblx0cHJpdmF0ZSBpbnB1dDogVGV4dENvbXBvbmVudCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHN1Z2dlc3Q6IFByb3BlcnR5S2V5U3VnZ2VzdCB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFwcDogQXBwLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBVcnNvUGx1Z2luLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczoge1xuXHRcdFx0aW5pdGlhbFZhbHVlPzogVHJhY2tlZFByb3BlcnR5U2V0dGluZztcblx0XHRcdG9uU2F2ZWQ6ICgpID0+IHZvaWQ7XG5cdFx0fSxcblx0KSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLnByb3BlcnR5S2V5ID0gb3B0aW9ucy5pbml0aWFsVmFsdWU/LnByb3BlcnR5S2V5ID8/IFwiXCI7XG5cdFx0dGhpcy5tb2RlID0gb3B0aW9ucy5pbml0aWFsVmFsdWU/Lm1vZGUgPz8gXCJub3Rlc1wiO1xuXHR9XG5cblx0b25PcGVuKCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0VGl0bGUodGhpcy5vcHRpb25zLmluaXRpYWxWYWx1ZSA/IFwiRWRpdCB0cmFja2VkIHByb3BlcnR5XCIgOiBcIkFkZCB0cmFja2VkIHByb3BlcnR5XCIpO1xuXHRcdHRoaXMubW9kYWxFbC5hZGRDbGFzcyhcInVyc28tdHJhY2tlZC1wcm9wZXJ0aWVzLW1vZGFsXCIpO1xuXG5cdFx0Y29uc3Qgd3JhcHBlciA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRyYWNrZWQtcHJvcGVydGllcy1lZGl0b3JcIiB9KTtcblx0XHR3cmFwcGVyLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwic2V0dGluZy1pdGVtLWRlc2NyaXB0aW9uXCIsXG5cdFx0XHR0ZXh0OiBcIkNob29zZSBhIHByb3BlcnR5IG5hbWUgYW5kIHdoZXRoZXIgVXJzbyBzaG91bGQgc2hvdyBtYXRjaGluZyBub3RlcyBkaXJlY3RseSBvciBncm91cCB0aGVtIGJ5IHZhbHVlLlwiLFxuXHRcdH0pO1xuXG5cdFx0bmV3IFNldHRpbmcod3JhcHBlcilcblx0XHRcdC5zZXROYW1lKFwiUHJvcGVydHkgbmFtZVwiKVxuXHRcdFx0LnNldERlc2MoXCJVc2UgYW4gZXhpc3RpbmcgcHJvcGVydHkgb3IgZW50ZXIgYSBuZXcgb25lLlwiKVxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+IHtcblx0XHRcdFx0dGhpcy5pbnB1dCA9IHRleHQ7XG5cdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoXCJQcm9wZXJ0eSBuYW1lXCIpLnNldFZhbHVlKHRoaXMucHJvcGVydHlLZXkpLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucHJvcGVydHlLZXkgPSB2YWx1ZS50cmltKCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRleHQuaW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHtcblx0XHRcdFx0XHRpZiAoZXZlbnQua2V5ID09PSBcIkVudGVyXCIpIHtcblx0XHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMuc2F2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIHRleHQ7XG5cdFx0XHR9KTtcblxuXHRcdGlmICh0aGlzLmlucHV0KSB7XG5cdFx0XHR0aGlzLnN1Z2dlc3QgPSBuZXcgUHJvcGVydHlLZXlTdWdnZXN0KFxuXHRcdFx0XHR0aGlzLmFwcCxcblx0XHRcdFx0dGhpcy5pbnB1dCxcblx0XHRcdFx0KCkgPT4gdGhpcy5wbHVnaW4uZ2V0QXZhaWxhYmxlUHJvcGVydHlLZXlzKCksXG5cdFx0XHRcdChwcm9wZXJ0eUtleSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucHJvcGVydHlLZXkgPSBwcm9wZXJ0eUtleTtcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0bmV3IFNldHRpbmcod3JhcHBlcilcblx0XHRcdC5zZXROYW1lKFwiRGlzcGxheSBtb2RlXCIpXG5cdFx0XHQuc2V0RGVzYyhcIkVpdGhlciBzaG93IGFsbCBub3RlcyB3aXRoIHRoYXQgcHJvcGVydHkgb3Igc2hvdyBzdWItY2F0ZWdvcmllcyBmb3IgZWFjaCB2YWx1ZS5cIilcblx0XHRcdC5hZGREcm9wZG93bigoZHJvcGRvd246IERyb3Bkb3duQ29tcG9uZW50KSA9PlxuXHRcdFx0XHRkcm9wZG93blxuXHRcdFx0XHRcdC5hZGRPcHRpb24oXCJub3Rlc1wiLCBcIlNob3cgbm90ZXMgd2l0aCB0aGF0IHByb3BlcnR5XCIpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbihcInZhbHVlc1wiLCBcIlNob3cgc3ViLWNhdGVnb3JpZXMgZm9yIGFsbCB2YWx1ZXNcIilcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5tb2RlKVxuXHRcdFx0XHRcdC5vbkNoYW5nZSgodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMubW9kZSA9IHZhbHVlID09PSBcInZhbHVlc1wiID8gXCJ2YWx1ZXNcIiA6IFwibm90ZXNcIjtcblx0XHRcdFx0XHR9KSxcblx0XHRcdCk7XG5cblx0XHRjb25zdCBhY3Rpb25zID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby10cmFja2VkLXByb3BlcnRpZXMtZWRpdG9yLWFjdGlvbnNcIiB9KTtcblx0XHRjb25zdCBzYXZlQnV0dG9uID0gbmV3IEJ1dHRvbkNvbXBvbmVudChhY3Rpb25zKTtcblx0XHRzYXZlQnV0dG9uLnNldEJ1dHRvblRleHQodGhpcy5vcHRpb25zLmluaXRpYWxWYWx1ZSA/IFwiU2F2ZVwiIDogXCJBZGRcIik7XG5cdFx0c2F2ZUJ1dHRvbi5zZXRDdGEoKTtcblx0XHRzYXZlQnV0dG9uLm9uQ2xpY2soKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnNhdmUoKTtcblx0XHR9KTtcblx0fVxuXG5cdG9uQ2xvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5zdWdnZXN0Py5jbG9zZSgpO1xuXHRcdHRoaXMuc3VnZ2VzdCA9IG51bGw7XG5cdFx0dGhpcy5jb250ZW50RWwuZW1wdHkoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2F2ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMucHJvcGVydHlLZXkpIHtcblx0XHRcdG5ldyBOb3RpY2UoXCJFbnRlciBhIHByb3BlcnR5IG5hbWUuXCIpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpZFNhdmUgPSBhd2FpdCB0aGlzLnBsdWdpbi51cHNlcnRUcmFja2VkUHJvcGVydHkoXG5cdFx0XHR7XG5cdFx0XHRcdHByb3BlcnR5S2V5OiB0aGlzLnByb3BlcnR5S2V5LFxuXHRcdFx0XHRtb2RlOiB0aGlzLm1vZGUsXG5cdFx0XHR9LFxuXHRcdFx0dGhpcy5vcHRpb25zLmluaXRpYWxWYWx1ZT8ucHJvcGVydHlLZXksXG5cdFx0KTtcblx0XHRpZiAoIWRpZFNhdmUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLm9wdGlvbnMub25TYXZlZCgpO1xuXHRcdHRoaXMuY2xvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVHJhY2tlZFByb3BlcnRpZXNNb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBsaXN0RWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBVcnNvUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0fVxuXG5cdG9uT3BlbigpOiB2b2lkIHtcblx0XHR0aGlzLnNldFRpdGxlKFwiVHJhY2tlZCBwcm9wZXJ0aWVzXCIpO1xuXHRcdHRoaXMubW9kYWxFbC5hZGRDbGFzcyhcInVyc28tdHJhY2tlZC1wcm9wZXJ0aWVzLW1vZGFsXCIpO1xuXG5cdFx0Y29uc3Qgd3JhcHBlciA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRyYWNrZWQtcHJvcGVydGllcy1tYW5hZ2VyXCIgfSk7XG5cdFx0d3JhcHBlci5jcmVhdGVEaXYoe1xuXHRcdFx0Y2xzOiBcInNldHRpbmctaXRlbS1kZXNjcmlwdGlvblwiLFxuXHRcdFx0dGV4dDogXCJUcmFja2VkIHByb3BlcnRpZXMgYXBwZWFyIGluIHRoZSBQcm9wZXJ0aWVzIHZpZXcuIEVhY2ggcHJvcGVydHkgY2FuIGVpdGhlciBzaG93IG1hdGNoaW5nIG5vdGVzIGRpcmVjdGx5IG9yIGdyb3VwIHRob3NlIG5vdGVzIGJ5IHZhbHVlLlwiLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdG9vbGJhciA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tdHJhY2tlZC1wcm9wZXJ0aWVzLXRvb2xiYXJcIiB9KTtcblx0XHRjb25zdCBhZGRCdXR0b24gPSBuZXcgQnV0dG9uQ29tcG9uZW50KHRvb2xiYXIpO1xuXHRcdGFkZEJ1dHRvbi5zZXRCdXR0b25UZXh0KFwiQWRkIHByb3BlcnR5XCIpO1xuXHRcdGFkZEJ1dHRvbi5zZXRDdGEoKTtcblx0XHRhZGRCdXR0b24ub25DbGljaygoKSA9PiB7XG5cdFx0XHR0aGlzLm9wZW5FZGl0b3IoKTtcblx0XHR9KTtcblxuXHRcdHRoaXMubGlzdEVsID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby10cmFja2VkLXByb3BlcnRpZXMtbGlzdFwiIH0pO1xuXHRcdHRoaXMucmVuZGVyVHJhY2tlZFByb3BlcnRpZXMoKTtcblx0fVxuXG5cdG9uQ2xvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jb250ZW50RWwuZW1wdHkoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVHJhY2tlZFByb3BlcnRpZXMoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmxpc3RFbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMubGlzdEVsLmVtcHR5KCk7XG5cblx0XHRjb25zdCB0cmFja2VkUHJvcGVydGllcyA9IHRoaXMucGx1Z2luLmdldFRyYWNrZWRQcm9wZXJ0aWVzKCk7XG5cdFx0aWYgKHRyYWNrZWRQcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5saXN0RWwuY3JlYXRlRGl2KHtcblx0XHRcdFx0Y2xzOiBcInVyc28tdHJhY2tlZC1wcm9wZXJ0aWVzLWVtcHR5XCIsXG5cdFx0XHRcdHRleHQ6IFwiTm8gdHJhY2tlZCBwcm9wZXJ0aWVzIHlldC5cIixcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgdHJhY2tlZFByb3BlcnR5IG9mIHRyYWNrZWRQcm9wZXJ0aWVzKSB7XG5cdFx0XHRjb25zdCBpdGVtID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcInVyc28tdHJhY2tlZC1wcm9wZXJ0aWVzLWl0ZW1cIiB9KTtcblx0XHRcdGNvbnN0IGRldGFpbHMgPSBpdGVtLmNyZWF0ZURpdih7IGNsczogXCJ1cnNvLXRyYWNrZWQtcHJvcGVydGllcy1kZXRhaWxzXCIgfSk7XG5cdFx0XHRkZXRhaWxzLmNyZWF0ZURpdih7XG5cdFx0XHRcdGNsczogXCJ1cnNvLXRyYWNrZWQtcHJvcGVydGllcy1uYW1lXCIsXG5cdFx0XHRcdHRleHQ6IHRyYWNrZWRQcm9wZXJ0eS5wcm9wZXJ0eUtleSxcblx0XHRcdH0pO1xuXHRcdFx0ZGV0YWlscy5jcmVhdGVEaXYoe1xuXHRcdFx0XHRjbHM6IFwidXJzby10cmFja2VkLXByb3BlcnRpZXMtbW9kZVwiLFxuXHRcdFx0XHR0ZXh0OlxuXHRcdFx0XHRcdHRyYWNrZWRQcm9wZXJ0eS5tb2RlID09PSBcInZhbHVlc1wiXG5cdFx0XHRcdFx0XHQ/IFwiU2hvdyBzdWItY2F0ZWdvcmllcyBmb3IgYWxsIHZhbHVlc1wiXG5cdFx0XHRcdFx0XHQ6IFwiU2hvdyBub3RlcyB3aXRoIHRoYXQgcHJvcGVydHlcIixcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBhY3Rpb25zID0gaXRlbS5jcmVhdGVEaXYoeyBjbHM6IFwidXJzby10cmFja2VkLXByb3BlcnRpZXMtYWN0aW9uc1wiIH0pO1xuXG5cdFx0XHRjb25zdCBlZGl0QnV0dG9uID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdGNsczogW1wiY2xpY2thYmxlLWljb25cIiwgXCJ1cnNvLXRyYWNrZWQtcHJvcGVydGllcy1hY3Rpb25cIl0sXG5cdFx0XHRcdGF0dHI6IHtcblx0XHRcdFx0XHR0eXBlOiBcImJ1dHRvblwiLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRzZXRJY29uKGVkaXRCdXR0b24sIFwicGVuY2lsXCIpO1xuXHRcdFx0ZWRpdEJ1dHRvbi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBgRWRpdCAke3RyYWNrZWRQcm9wZXJ0eS5wcm9wZXJ0eUtleX1gKTtcblx0XHRcdGVkaXRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy5vcGVuRWRpdG9yKHRyYWNrZWRQcm9wZXJ0eSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcmVtb3ZlQnV0dG9uID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG5cdFx0XHRcdGNsczogW1wiY2xpY2thYmxlLWljb25cIiwgXCJ1cnNvLXRyYWNrZWQtcHJvcGVydGllcy1hY3Rpb25cIl0sXG5cdFx0XHRcdGF0dHI6IHtcblx0XHRcdFx0XHR0eXBlOiBcImJ1dHRvblwiLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRzZXRJY29uKHJlbW92ZUJ1dHRvbiwgXCJ0cmFzaC0yXCIpO1xuXHRcdFx0cmVtb3ZlQnV0dG9uLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIGBSZW1vdmUgJHt0cmFja2VkUHJvcGVydHkucHJvcGVydHlLZXl9YCk7XG5cdFx0XHRyZW1vdmVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdFx0dm9pZCB0aGlzLnBsdWdpbi5yZW1vdmVUcmFja2VkUHJvcGVydHkodHJhY2tlZFByb3BlcnR5LnByb3BlcnR5S2V5KS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnJlbmRlclRyYWNrZWRQcm9wZXJ0aWVzKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvcGVuRWRpdG9yKGluaXRpYWxWYWx1ZT86IFRyYWNrZWRQcm9wZXJ0eVNldHRpbmcpOiB2b2lkIHtcblx0XHRuZXcgVHJhY2tlZFByb3BlcnR5RWRpdG9yTW9kYWwodGhpcy5hcHAsIHRoaXMucGx1Z2luLCB7XG5cdFx0XHRpbml0aWFsVmFsdWUsXG5cdFx0XHRvblNhdmVkOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMucmVuZGVyVHJhY2tlZFByb3BlcnRpZXMoKTtcblx0XHRcdH0sXG5cdFx0fSkub3BlbigpO1xuXHR9XG59XG4iXX0=