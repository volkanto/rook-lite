import { CategoryRepository, DraftRepository, NoteRepository, database } from "./db";
import { deriveTitle, extractTags, plainText } from "./markdown";
import type { Category, Draft, Note } from "./models";

const DEFAULT_CATEGORIES = ["1:1", "Project", "Incident", "Feedback", "Learning", "Meeting", "Win"];

export class NoteService {
  constructor(private readonly notes = new NoteRepository(), private readonly drafts = new DraftRepository()) {}

  async listAll(): Promise<Note[]> {
    return this.notes.listAll();
  }

  async listByDate(date: string): Promise<Note[]> {
    return this.notes.listByDate(date);
  }

  async create(content: string, noteDate: string, categoryIds: string[]): Promise<Note> {
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      title: deriveTitle(content),
      content: content.trim(),
      categoryIds: [...new Set(categoryIds)],
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

  async update(id: string, content: string, categoryIds: string[]): Promise<Note> {
    const existing = await this.notes.get(id);
    if (!existing) throw new Error("That note no longer exists.");
    const note = { ...existing, content: content.trim(), title: deriveTitle(content), tags: extractTags(content), categoryIds: [...new Set(categoryIds)], updatedAt: new Date().toISOString() };
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
    return this.update(note.id, lines.join("\n"), note.categoryIds);
  }

  async saveDraft(noteDate: string, content: string, categoryIds: string[]): Promise<void> {
    const draft: Draft = { id: draftId(noteDate), noteId: null, noteDate, content, categoryIds, updatedAt: new Date().toISOString() };
    if (!content.trim() && categoryIds.length === 0) await this.drafts.delete(draft.id);
    else await this.drafts.save(draft);
  }

  async getDraft(noteDate: string): Promise<Draft | undefined> {
    return this.drafts.get(draftId(noteDate));
  }

  searchableText(note: Note, categoryNames: string[]): string {
    return normalize([note.title, plainText(note.content), categoryNames.join(" "), note.tags.join(" ")].filter(Boolean).join(" "));
  }
}

export class CategoryService {
  constructor(private readonly categories = new CategoryRepository()) {}

  async seedDefaults(): Promise<void> {
    const existing = await this.categories.list();
    if (existing.length > 0) return;
    for (const [index, name] of DEFAULT_CATEGORIES.entries()) await this.create(name, index);
  }

  list(): Promise<Category[]> {
    return this.categories.list();
  }

  async create(name: string, sortOrder?: number): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Enter a category name.");
    const slug = slugify(trimmed);
    const existing = await this.categories.list();
    if (existing.some((category) => category.slug === slug)) throw new Error("A category with that name already exists.");
    const now = new Date().toISOString();
    const category: Category = { id: crypto.randomUUID(), name: trimmed, slug, color: "#6b7280", sortOrder: sortOrder ?? existing.length, archived: false, createdAt: now, updatedAt: now };
    await this.categories.save(category);
    return category;
  }

  async rename(id: string, name: string): Promise<void> {
    const categories = await this.categories.list();
    const category = categories.find((item) => item.id === id);
    if (!category) throw new Error("That category no longer exists.");
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (!trimmed) throw new Error("Enter a category name.");
    if (categories.some((item) => item.id !== id && item.slug === slug)) throw new Error("A category with that name already exists.");
    await this.categories.save({ ...category, name: trimmed, slug, updatedAt: new Date().toISOString() });
  }

  async archive(id: string): Promise<void> {
    const category = (await this.categories.list()).find((item) => item.id === id);
    if (!category) throw new Error("That category no longer exists.");
    await this.categories.save({ ...category, archived: true, updatedAt: new Date().toISOString() });
  }

  delete(id: string): Promise<void> {
    return this.categories.deleteAndDetach(id);
  }
}

export async function initializeLocalData(): Promise<void> {
  await database();
  await new CategoryService().seedDefaults();
  if (navigator.storage?.persist) await navigator.storage.persist();
}

export function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("und").replace(/\s+/g, " ").trim();
}

export function slugify(value: string): string {
  return normalize(value).replace(/[^a-z0-9\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "category";
}

function draftId(noteDate: string): string {
  return `new:${noteDate}`;
}
