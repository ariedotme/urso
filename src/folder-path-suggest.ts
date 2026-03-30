import { AbstractInputSuggest, App, TextComponent } from "obsidian";

interface FolderPathSuggestion {
	displayText: string;
	path: string;
}

const ROOT_FOLDER_LABEL = "Vault root";

export class FolderPathSuggest extends AbstractInputSuggest<FolderPathSuggestion> {
	constructor(
		app: App,
		private readonly text: TextComponent,
		private readonly onChoose: (value: string) => void,
	) {
		super(app, text.inputEl);
	}

	getSuggestions(query: string): FolderPathSuggestion[] {
		const normalizedQuery = query.trim().toLowerCase();
		const suggestions: FolderPathSuggestion[] = [];

		if (!normalizedQuery || ROOT_FOLDER_LABEL.toLowerCase().includes(normalizedQuery)) {
			suggestions.push({
				displayText: ROOT_FOLDER_LABEL,
				path: "",
			});
		}

		const folders = this.app.vault.getAllFolders(false);
		const startsWithMatches: FolderPathSuggestion[] = [];
		const includesMatches: FolderPathSuggestion[] = [];

		for (const folder of folders) {
			const normalizedPath = folder.path.toLowerCase();
			const suggestion = {
				displayText: folder.path,
				path: folder.path,
			};

			if (!normalizedQuery || normalizedPath.startsWith(normalizedQuery)) {
				startsWithMatches.push(suggestion);
				continue;
			}

			if (normalizedPath.includes(normalizedQuery)) {
				includesMatches.push(suggestion);
			}
		}

		return [...suggestions, ...startsWithMatches, ...includesMatches];
	}

	renderSuggestion(value: FolderPathSuggestion, el: HTMLElement): void {
		el.createDiv({ text: value.displayText });
	}

	selectSuggestion(value: FolderPathSuggestion): void {
		this.text.setValue(value.path);
		this.onChoose(value.path);
		this.close();
	}
}
