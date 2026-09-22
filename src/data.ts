import { strToU8, zipSync } from "fflate";
import { dataSnapshot, restoreSnapshot, SettingsRepository } from "./db";
import type { Category, Note, OllamaSettings, RookBackupV1, Setting, Summary } from "./models";

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettings = { enabled: false, endpoint: "http://localhost:11434", model: "llama3.2", temperature: 0.2, timeoutMs: 60000 };
export const settingsRepository = new SettingsRepository();

export async function createBackup(): Promise<RookBackupV1> {
  const snapshot = await dataSnapshot();
  const allowedSettings = snapshot.settings.filter((setting) => ["ollama", "theme", "lastExportAt"].includes(setting.key));
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), application: { name: "rook-lite", version: "0.1.0" }, notes: snapshot.notes, categories: snapshot.categories, summaries: snapshot.summaries, settings: allowedSettings };
}

export function parseBackup(value: string): RookBackupV1 {
  let candidate: unknown;
  try { candidate = JSON.parse(value); } catch { throw new Error("That file is not valid JSON."); }
  if (!isRecord(candidate) || candidate.schemaVersion !== 1) throw new Error("This backup schema is not supported.");
  if (!Array.isArray(candidate.notes) || !Array.isArray(candidate.categories) || !Array.isArray(candidate.summaries) || !Array.isArray(candidate.settings)) throw new Error("The backup is incomplete.");
  if (!candidate.notes.every(validNote) || !candidate.categories.every(validCategory) || !candidate.summaries.every(validSummary) || !candidate.settings.every(validSetting)) throw new Error("The backup contains invalid records.");
  const noteIds = new Set(candidate.notes.map((note) => note.id)); const categoryIds = new Set(candidate.categories.map((category) => category.id));
  if (noteIds.size !== candidate.notes.length || categoryIds.size !== candidate.categories.length) throw new Error("The backup contains duplicate IDs.");
  if (candidate.notes.some((note) => note.categoryIds.some((id) => !categoryIds.has(id)))) throw new Error("A note refers to a missing category.");
  return candidate as unknown as RookBackupV1;
}

export async function restoreBackup(backup: RookBackupV1): Promise<void> {
  await restoreSnapshot({ notes: backup.notes, categories: backup.categories, summaries: backup.summaries, settings: backup.settings });
}

export function downloadJson(backup: RookBackupV1): void {
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `rook-lite-backup-${backup.exportedAt.slice(0, 10)}.json`);
}

export function markdownFile(note: Note, categories: Category[]): { path: string; content: string } {
  const week = isoWeek(new Date(`${note.noteDate}T12:00:00`)); const names = categories.filter((category) => note.categoryIds.includes(category.id)).map((category) => category.name);
  const title = note.title ?? "Untitled note"; const slug = safeSlug(title); const yamlList = (values: string[]) => values.length ? `\n${values.map((value) => `  - ${quoteYaml(value)}`).join("\n")}` : " []";
  const front = `---\nid: ${quoteYaml(note.id)}\ntitle: ${quoteYaml(title)}\ndate: ${note.noteDate}\nisoWeekYear: ${week.year}\nisoWeek: ${week.week}\ncategories:${yamlList(names)}\ntags:${yamlList(note.tags)}\ncreatedAt: ${quoteYaml(note.createdAt)}\nupdatedAt: ${quoteYaml(note.updatedAt)}\n---\n\n`;
  const startsWithTitle = new RegExp(`^#{1,6}\\s+${escapeRegex(title)}\\s*$`, "im").test(note.content.split(/\r?\n/)[0] ?? "");
  return { path: `${note.noteDate.slice(0, 4)}/${note.noteDate.slice(5, 7)}/week-${String(week.week).padStart(2, "0")}/${note.noteDate}-${slug}-${note.id.slice(0, 8)}.md`, content: `${front}${startsWithTitle ? "" : `# ${title}\n\n`}${note.content.trim()}\n` };
}

export function createMarkdownZip(notes: Note[], categories: Category[]): Blob {
  const files: Record<string, Uint8Array> = { "rook-export/README.md": strToU8(`# Rook Lite export\n\n${notes.length} notes, one Markdown file each.\n`) };
  for (const note of notes) { const file = markdownFile(note, categories); files[`rook-export/${file.path}`] = strToU8(file.content); }
  return new Blob([zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>], { type: "application/zip" });
}

export async function exportToDirectory(notes: Note[], categories: Category[]): Promise<number> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  if (!picker) throw new Error("Directory export is not supported by this browser.");
  const root = await picker(); const exportRoot = await root.getDirectoryHandle("rook-export", { create: true });
  for (const note of notes) {
    const file = markdownFile(note, categories); const parts = file.path.split("/"); const filename = parts.pop() as string; let directory = exportRoot;
    for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
    const handle = await directory.getFileHandle(filename, { create: true }); const writable = await handle.createWritable(); await writable.write(file.content); await writable.close();
  }
  await settingsRepository.set("lastExportAt", new Date().toISOString()); return notes.length;
}

export function downloadMarkdownZip(notes: Note[], categories: Category[]): void { downloadBlob(createMarkdownZip(notes, categories), `rook-export-${new Date().toISOString().slice(0, 10)}.zip`); }
export function downloadBlob(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function safeSlug(value: string): string { return value.normalize("NFKD").toLocaleLowerCase("und").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "note"; }
function quoteYaml(value: string): string { return JSON.stringify(value); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function isoWeek(date: Date): { year: number; week: number } { const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7)); return { year: value.getUTCFullYear(), week: Math.ceil((((value.getTime() - Date.UTC(value.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7) }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function validNote(value: unknown): value is Note { return isRecord(value) && typeof value.id === "string" && typeof value.content === "string" && typeof value.noteDate === "string" && strings(value.categoryIds) && strings(value.tags) && typeof value.createdAt === "string" && typeof value.updatedAt === "string" && typeof value.archived === "boolean"; }
function validCategory(value: unknown): value is Category { return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.slug === "string" && typeof value.sortOrder === "number" && typeof value.archived === "boolean"; }
function validSummary(value: unknown): value is Summary { return isRecord(value) && typeof value.id === "string" && typeof value.generatedMarkdown === "string" && typeof value.periodStart === "string" && typeof value.periodEnd === "string" && strings(value.sourceNoteIds); }
function validSetting(value: unknown): value is Setting { return isRecord(value) && typeof value.key === "string" && "value" in value && typeof value.updatedAt === "string"; }
