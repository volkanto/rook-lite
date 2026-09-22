export interface Note {
  id: string;
  title: string | null;
  content: string;
  categoryIds: string[];
  tags: string[];
  noteDate: string;
  language: "tr" | "en" | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Summary {
  id: string;
  type: "weekly" | "monthly" | "yearly" | "custom";
  periodStart: string;
  periodEnd: string;
  engine: "rule-based" | "ollama";
  model: string | null;
  generatedMarkdown: string;
  editedMarkdown: string | null;
  sourceNoteIds: string[];
  noteCount: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Setting<T = unknown> {
  key: string;
  value: T;
  updatedAt: string;
}

export interface Draft {
  id: string;
  noteId: string | null;
  noteDate: string;
  content: string;
  categoryIds: string[];
  updatedAt: string;
}

export interface OllamaSettings {
  enabled: boolean;
  endpoint: string;
  model: string;
  temperature: number;
  timeoutMs: number;
}

export interface RookBackupV1 {
  schemaVersion: 1;
  exportedAt: string;
  application: { name: "rook-lite"; version: string };
  notes: Note[];
  categories: Category[];
  summaries: Summary[];
  settings: Setting[];
}
