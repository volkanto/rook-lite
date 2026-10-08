import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { Draft, Note, Setting, Summary } from "./models";

const DATABASE_NAME = "rook-lite";
const DATABASE_VERSION = 2;

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
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        migrateToV1(db);
      }
      if (oldVersion < 2) {
        migrateToV2(db, transaction);
      }
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

  const summaries = db.createObjectStore("summaries", { keyPath: "id" });
  summaries.createIndex("periodStart", "periodStart");
  summaries.createIndex("generatedAt", "generatedAt");

  db.createObjectStore("settings", { keyPath: "key" });
  const drafts = db.createObjectStore("drafts", { keyPath: "id" });
  drafts.createIndex("noteId", "noteId");
  drafts.createIndex("updatedAt", "updatedAt");
}

function migrateToV2(db: IDBPDatabase<RookLiteSchema>, transaction: any): void {
  if (db.objectStoreNames.contains("categories" as any)) {
    db.deleteObjectStore("categories" as any);
  }
  // Strip categoryIds from existing notes
  if (transaction && db.objectStoreNames.contains("notes")) {
    const notesStore = transaction.objectStore("notes");
    notesStore.openCursor().then(function stripCategories(cursor: any): Promise<void> | void {
      if (!cursor) return;
      const note = cursor.value;
      if ("categoryIds" in note) {
        delete note.categoryIds;
        cursor.update(note);
      }
      return cursor.continue().then(stripCategories);
    });
  }
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

export async function dataSnapshot(): Promise<{ notes: Note[]; summaries: Summary[]; settings: Setting[] }> {
  const db = await database();
  const transaction = db.transaction(["notes", "summaries", "settings"]);
  const [notes, summaries, settings] = await Promise.all([
    transaction.objectStore("notes").getAll(),
    transaction.objectStore("summaries").getAll(),
    transaction.objectStore("settings").getAll()
  ]);
  return { notes, summaries, settings };
}

export async function restoreSnapshot(snapshot: { notes: Note[]; summaries: Summary[]; settings: Setting[] }): Promise<void> {
  const db = await database();
  const transaction = db.transaction(["notes", "summaries", "settings", "drafts"], "readwrite");
  const notes = transaction.objectStore("notes");
  const summaries = transaction.objectStore("summaries");
  const settings = transaction.objectStore("settings");
  await Promise.all([notes.clear(), summaries.clear(), settings.clear(), transaction.objectStore("drafts").clear()]);
  await Promise.all(snapshot.notes.map((item) => notes.put(item)));
  await Promise.all(snapshot.summaries.map((item) => summaries.put(item)));
  await Promise.all(snapshot.settings.map((item) => settings.put(item)));
  await transaction.done;
}

export async function storageCounts(): Promise<{ notes: number; summaries: number }> {
  const db = await database();
  const transaction = db.transaction(["notes", "summaries"]);
  const [notes, summaries] = await Promise.all([
    transaction.objectStore("notes").count(),
    transaction.objectStore("summaries").count()
  ]);
  return { notes, summaries };
}

export async function clearAllData(): Promise<void> {
  const db = await database();
  const stores = ["notes", "summaries", "settings", "drafts"] as const;
  const transaction = db.transaction(stores, "readwrite");
  await Promise.all(stores.map((store) => transaction.objectStore(store).clear()));
  await transaction.done;
}
