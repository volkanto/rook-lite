import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { Category, Draft, Note, Setting, Summary } from "./models";

const DATABASE_NAME = "rook-lite";
const DATABASE_VERSION = 1;

interface RookLiteSchema extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: {
      noteDate: string;
      createdAt: string;
      updatedAt: string;
    };
  };
  categories: {
    key: string;
    value: Category;
    indexes: {
      slug: string;
      sortOrder: number;
    };
  };
  summaries: {
    key: string;
    value: Summary;
    indexes: { periodStart: string; generatedAt: string };
  };
  settings: { key: string; value: Setting };
  drafts: {
    key: string;
    value: Draft;
    indexes: { noteId: string; updatedAt: string };
  };
}

let databasePromise: Promise<IDBPDatabase<RookLiteSchema>> | undefined;

export function database(): Promise<IDBPDatabase<RookLiteSchema>> {
  databasePromise ??= openDB<RookLiteSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) migrateToV1(db);
    },
    blocked() {
      window.dispatchEvent(new CustomEvent("rook:database-blocked"));
    }
  });
  return databasePromise;
}

function migrateToV1(db: IDBPDatabase<RookLiteSchema>): void {
  const notes = db.createObjectStore("notes", { keyPath: "id" });
  notes.createIndex("noteDate", "noteDate");
  notes.createIndex("createdAt", "createdAt");
  notes.createIndex("updatedAt", "updatedAt");

  const categories = db.createObjectStore("categories", { keyPath: "id" });
  categories.createIndex("slug", "slug", { unique: true });
  categories.createIndex("sortOrder", "sortOrder");

  const summaries = db.createObjectStore("summaries", { keyPath: "id" });
  summaries.createIndex("periodStart", "periodStart");
  summaries.createIndex("generatedAt", "generatedAt");

  db.createObjectStore("settings", { keyPath: "key" });
  const drafts = db.createObjectStore("drafts", { keyPath: "id" });
  drafts.createIndex("noteId", "noteId");
  drafts.createIndex("updatedAt", "updatedAt");
}

export class NoteRepository {
  async get(id: string): Promise<Note | undefined> {
    return (await database()).get("notes", id);
  }

  async listAll(): Promise<Note[]> {
    return (await database()).getAll("notes");
  }

  async listByDate(noteDate: string): Promise<Note[]> {
    const notes = await (await database()).getAllFromIndex("notes", "noteDate", noteDate);
    return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async save(note: Note): Promise<void> {
    await (await database()).put("notes", note);
  }

  async delete(id: string): Promise<void> {
    await (await database()).delete("notes", id);
  }
}

export class CategoryRepository {
  async list(): Promise<Category[]> {
    const categories = await (await database()).getAll("categories");
    return categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async save(category: Category): Promise<void> {
    await (await database()).put("categories", category);
  }

  async deleteAndDetach(id: string): Promise<void> {
    const db = await database();
    const transaction = db.transaction(["categories", "notes"], "readwrite");
    const notes = await transaction.objectStore("notes").getAll();
    await Promise.all(notes.filter((note) => note.categoryIds.includes(id)).map((note) => transaction.objectStore("notes").put({
      ...note,
      categoryIds: note.categoryIds.filter((categoryId) => categoryId !== id),
      updatedAt: new Date().toISOString()
    })));
    await transaction.objectStore("categories").delete(id);
    await transaction.done;
  }
}

export class DraftRepository {
  async get(id: string): Promise<Draft | undefined> {
    return (await database()).get("drafts", id);
  }

  async save(draft: Draft): Promise<void> {
    await (await database()).put("drafts", draft);
  }

  async delete(id: string): Promise<void> {
    await (await database()).delete("drafts", id);
  }
}

export class SummaryRepository {
  async list(): Promise<Summary[]> {
    return (await (await database()).getAll("summaries")).sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }

  async get(id: string): Promise<Summary | undefined> {
    return (await database()).get("summaries", id);
  }

  async save(summary: Summary): Promise<void> {
    await (await database()).put("summaries", summary);
  }
}

export class SettingsRepository {
  async get<T>(key: string): Promise<T | undefined> {
    return (await (await database()).get("settings", key))?.value as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await (await database()).put("settings", { key, value, updatedAt: new Date().toISOString() });
  }

  async list(): Promise<Setting[]> {
    return (await database()).getAll("settings");
  }
}

export async function dataSnapshot(): Promise<{ notes: Note[]; categories: Category[]; summaries: Summary[]; settings: Setting[] }> {
  const db = await database();
  const transaction = db.transaction(["notes", "categories", "summaries", "settings"]);
  const [notes, categories, summaries, settings] = await Promise.all([
    transaction.objectStore("notes").getAll(), transaction.objectStore("categories").getAll(),
    transaction.objectStore("summaries").getAll(), transaction.objectStore("settings").getAll()
  ]);
  return { notes, categories, summaries, settings };
}

export async function restoreSnapshot(snapshot: { notes: Note[]; categories: Category[]; summaries: Summary[]; settings: Setting[] }): Promise<void> {
  const db = await database();
  const transaction = db.transaction(["notes", "categories", "summaries", "settings", "drafts"], "readwrite");
  const notes = transaction.objectStore("notes"); const categories = transaction.objectStore("categories");
  const summaries = transaction.objectStore("summaries"); const settings = transaction.objectStore("settings");
  await Promise.all([notes.clear(), categories.clear(), summaries.clear(), settings.clear(), transaction.objectStore("drafts").clear()]);
  await Promise.all(snapshot.notes.map((item) => notes.put(item)));
  await Promise.all(snapshot.categories.map((item) => categories.put(item)));
  await Promise.all(snapshot.summaries.map((item) => summaries.put(item)));
  await Promise.all(snapshot.settings.map((item) => settings.put(item)));
  await transaction.done;
}

export async function storageCounts(): Promise<{ notes: number; categories: number; summaries: number }> {
  const db = await database();
  const transaction = db.transaction(["notes", "categories", "summaries"]);
  const [notes, categories, summaries] = await Promise.all([
    transaction.objectStore("notes").count(),
    transaction.objectStore("categories").count(),
    transaction.objectStore("summaries").count()
  ]);
  return { notes, categories, summaries };
}

export async function clearAllData(): Promise<void> {
  const db = await database();
  const stores = ["notes", "categories", "summaries", "settings", "drafts"] as const;
  const transaction = db.transaction(stores, "readwrite");
  await Promise.all(stores.map((store) => transaction.objectStore(store).clear()));
  await transaction.done;
}
