import { TFile } from "obsidian";

export const VIEW_TYPE_URSO = "urso-view";
export const UNTAGGED_KEY = "__untagged__";

export type NotesInheritanceMode = "leaf-only" | "include-ancestors";
export type NotesSecondaryLineMode = "updated-date" | "created-date" | "none";
export type NotesSortOrder = "updated-desc" | "updated-asc" | "created-desc" | "created-asc" | "title-asc";
export type PrimaryViewMode = "tags" | "properties";
export type TrackedPropertyMode = "notes" | "values";
export type UntaggedPosition = "top" | "bottom";

export type CreateNoteContext =
	| {
			type: "tag";
			tagKey: string | null;
	  }
	| {
			type: "property";
			propertyKey: string;
			propertyValue: string | null;
	  };

export interface TrackedPropertySetting {
	propertyKey: string;
	mode: TrackedPropertyMode;
}

export interface UrsoPluginSettings {
	hiddenTags: string[];
	inheritanceMode: NotesInheritanceMode;
	pinnedNotes: Record<string, string[]>;
	pinnedProperties: string[];
	pinnedTags: string[];
	newNoteFolder: string;
	noteDateFormat: string;
	noteIcons: Record<string, string>;
	noteSecondaryLineMode: NotesSecondaryLineMode;
	notesSortOrder: NotesSortOrder;
	primaryViewMode: PrimaryViewMode;
	propertyIcons: Record<string, string>;
	splitPaneRatio: number;
	showCounts: boolean;
	trackedProperties: TrackedPropertySetting[];
	tagIcons: Record<string, string>;
	showUntagged: boolean;
	underlinePinnedItems: boolean;
	untaggedLabel: string;
	untaggedPosition: UntaggedPosition;
	useMobileLayoutOnTablet: boolean;
}

export interface TagNode {
	key: string;
	name: string;
	fullPath: string;
	children: TagNode[];
	noteCount: number;
	isSpecial?: boolean;
}

export interface PropertyNode {
	key: string;
	name: string;
	propertyKey: string;
	children: PropertyNode[];
	noteCount: number;
	propertyValue?: string;
}

export interface IndexedTagData {
	tagTree: TagNode[];
	notesByTag: Map<string, TFile[]>;
	propertyTree: PropertyNode[];
	notesByProperty: Map<string, TFile[]>;
	untaggedNotes: TFile[];
}
