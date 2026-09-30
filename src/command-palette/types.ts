import type { Category, Note } from "../models";

export type CommandGroup =
  | "notes"
  | "summaries"
  | "navigation"
  | "data"
  | "appearance"
  | "settings"
  | "contextual";

export interface CommandContext {
  currentPath: string;
  currentDate?: string;
  selectedNote?: Note | null;
  activeNotes?: Note[];
  allCategories?: Category[];
  isZenMode?: boolean;
  currentTheme?: string;
  hasSummary?: boolean;
  summaryPeriodType?: string;
  summaryMarkdown?: string;
  summaryId?: string;
  showDatePickerPrompt?: () => void;
  openTasksView?: () => void;
}

export interface CommandActions {
  navigateTo: (path: string) => void | Promise<void>;
  createNote: () => void;
  openDatePicker: () => void;
  shiftDate: (delta: number) => void;
  openTasks: () => void;
  toggleTheme: () => void;
  setTheme: (theme: "LIGHT" | "DARK" | "SYSTEM") => void;
  toggleZen: () => void;
  openShortcuts?: () => void;
  exportMarkdownZip: () => void | Promise<void>;
  exportMarkdownDirectory?: () => void | Promise<void>;
  createBackup: () => void | Promise<void>;
  triggerRestoreBackup: () => void;
  editSelectedNote?: (note: Note) => void;
  copySelectedNote?: (note: Note) => void;
  deleteSelectedNote?: (note: Note) => void;
  regenerateSummary?: () => void;
  copySummary?: () => void;
  downloadSummary?: () => void;
}

export interface Command {
  id: string;
  title: string;
  description?: string;
  keywords: string[];
  shortcut?: string;
  icon?: string;
  group: CommandGroup;
  isAvailable?: (context: CommandContext) => boolean;
  execute: (context: CommandContext) => void | Promise<void>;
}

export interface ParsedSearch {
  raw: string;
  text: string;
  tags: string[];
  categories: string[];
  hasTask?: boolean;
  after?: string;
  before?: string;
  activeFilter?: {
    type: "tag" | "category";
    value: string;
    startIndex: number;
  } | null;
}

export interface RecentCommand {
  id: string;
  lastUsedAt: number;
  useCount: number;
}

export interface PaletteCommandItem {
  type: "command";
  id: string;
  title: string;
  description?: string;
  shortcut?: string;
  icon?: string;
  group: string;
  command: Command;
}

export interface PaletteNoteItem {
  type: "note";
  id: string;
  title: string;
  contentExcerpt: string;
  noteDate: string;
  categoryName?: string;
  tags: string[];
  openTaskCount: number;
  href: string;
  note: Note;
}

export interface PaletteTaskItem {
  type: "task";
  id: string;
  noteId: string;
  taskText: string;
  noteDate: string;
  categoryName?: string;
  lineIndex: number;
  href: string;
}

export interface PaletteSuggestionItem {
  type: "suggestion";
  id: string;
  filterType: "tag" | "category";
  value: string;
  label: string;
  count?: number;
}

export type PaletteItem =
  | PaletteCommandItem
  | PaletteNoteItem
  | PaletteTaskItem
  | PaletteSuggestionItem;

export interface PaletteSection {
  title: string;
  items: PaletteItem[];
}
