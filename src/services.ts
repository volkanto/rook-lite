import { DraftRepository, NoteRepository, database } from "./db";
import { deriveTitle, extractTags, plainText } from "./markdown";
import type { Draft, Note } from "./models";

export class NoteService {
  constructor(private readonly notes = new NoteRepository(), private readonly drafts = new DraftRepository()) {}

  async listAll(): Promise<Note[]> {
    return this.notes.listAll();
  }

  async listByDate(date: string): Promise<Note[]> {
    return this.notes.listByDate(date);
  }

  async create(content: string, noteDate: string): Promise<Note> {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Note content cannot be empty.");
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      title: deriveTitle(content),
      content: trimmed,
      tags: extractTags(content),
      noteDate,
      language: null,
      createdAt: now,
      updatedAt: now,
      archived: false
    };
    await this.notes.save(note);
    await this.drafts.delete(draftId(noteDate));
    return note;
  }

  async update(id: string, content: string): Promise<Note> {
    const existing = await this.notes.get(id);
    if (!existing) throw new Error("That note no longer exists.");
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Note content cannot be empty.");
    const note: Note = {
      ...existing,
      content: trimmed,
      title: deriveTitle(content),
      tags: extractTags(content),
      updatedAt: new Date().toISOString()
    };
    await this.notes.save(note);
    return note;
  }

  async delete(id: string): Promise<void> {
    await this.notes.delete(id);
  }

  async setTaskDone(noteId: string, lineIndex: number, done: boolean): Promise<Note> {
    const note = await this.notes.get(noteId);
    if (!note) throw new Error("The source note no longer exists.");
    const lines = note.content.split(/\r?\n/);
    const line = lines[lineIndex];
    if (line === undefined || !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)) throw new Error("That task has changed. Reload the page and try again.");
    lines[lineIndex] = line.replace(/^(\s*[-*+]\s+\[)[ xX](\]\s+)/, `$1${done ? "x" : " "}$2`);
    return this.update(note.id, lines.join("\n"));
  }

  async saveDraft(noteDate: string, content: string): Promise<void> {
    const draft: Draft = { id: draftId(noteDate), noteId: null, noteDate, content, updatedAt: new Date().toISOString() };
    if (!content.trim()) await this.drafts.delete(draft.id);
    else await this.drafts.save(draft);
  }

  async getDraft(noteDate: string): Promise<Draft | undefined> {
    return this.drafts.get(draftId(noteDate));
  }

  searchableText(note: Note): string {
    return normalize([note.title, plainText(note.content), note.tags.join(" ")].filter(Boolean).join(" "));
  }
}

export async function initializeLocalData(): Promise<void> {
  await database();
  if (navigator.storage?.persist) await navigator.storage.persist();
}

export function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("und").replace(/\s+/g, " ").trim();
}

export function slugify(value: string): string {
  return normalize(value).replace(/[^a-z0-9\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "item";
}

function draftId(noteDate: string): string {
  return `new:${noteDate}`;
}
