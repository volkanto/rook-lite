// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAllData, database, NoteRepository } from "./db";
import { FolderService, NoteService } from "./services";
import { createBackup, markdownFile, parseBackup, restoreBackup } from "./data";
import { RuleBasedSummaryEngine, summaryPeriod } from "./summaries";
import type { Folder, Note, RookBackupV1 } from "./models";
import { renderShell, renderToday } from "./main";

// Ensure JSDOM environment has required globals before importing main.ts
document.body.innerHTML = '<div id="app"></div>';
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
});

beforeEach(async () => {
  await clearAllData();
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState({}, "", "/");
});

describe("FolderService & Validation", () => {
  it("creates, retrieves, and lists folders sorted alphabetically", async () => {
    const service = new FolderService();
    const f1 = await service.create("Work");
    const f2 = await service.create("Personal");
    const f3 = await service.create("Archived Projects");

    expect(f1.id).toBeDefined();
    expect(f2.id).toBeDefined();
    expect(f3.id).toBeDefined();
    expect(f1.name).toBe("Work");

    const retrieved = await service.get(f1.id);
    expect(retrieved?.name).toBe("Work");

    const all = await service.listAll();
    expect(all).toHaveLength(3);
    expect(all.map((f) => f.name)).toEqual(["Archived Projects", "Personal", "Work"]);
  });

  it("trims whitespace from folder names", async () => {
    const service = new FolderService();
    const folder = await service.create("   Projects   ");
    expect(folder.name).toBe("Projects");

    const renamed = await service.rename(folder.id, "   Deep Work   ");
    expect(renamed.name).toBe("Deep Work");
  });

  it("rejects empty or whitespace-only folder names", async () => {
    const service = new FolderService();
    await expect(service.create("")).rejects.toThrow(/empty/i);
    await expect(service.create("   ")).rejects.toThrow(/empty/i);

    const folder = await service.create("Valid");
    await expect(service.rename(folder.id, "")).rejects.toThrow(/empty/i);
    await expect(service.rename(folder.id, "   ")).rejects.toThrow(/empty/i);
  });

  it("rejects duplicate folder names using case-insensitive comparison", async () => {
    const service = new FolderService();
    await service.create("Journal");

    await expect(service.create("journal")).rejects.toThrow(/already exists/i);
    await expect(service.create("JOURNAL")).rejects.toThrow(/already exists/i);
    await expect(service.create("  journal  ")).rejects.toThrow(/already exists/i);

    const second = await service.create("Ideas");
    await expect(service.rename(second.id, "journal")).rejects.toThrow(/already exists/i);
  });

  it("rejects reserved names for built-in views in English and Turkish", async () => {
    const service = new FolderService();
    await expect(service.create("All notes")).rejects.toThrow(/reserved/i);
    await expect(service.create("all")).rejects.toThrow(/reserved/i);
    await expect(service.create("Unfiled")).rejects.toThrow(/reserved/i);
    await expect(service.create("unfiled")).rejects.toThrow(/reserved/i);
    await expect(service.create("Tüm notlar")).rejects.toThrow(/reserved/i);
    await expect(service.create("Dosyalanmamış")).rejects.toThrow(/reserved/i);
  });
});

describe("Note Folder Assignments & Preservation", () => {
  it("creates notes with optional folder assignment", async () => {
    const folderService = new FolderService();
    const noteService = new NoteService();

    const folder = await folderService.create("Research");
    const unfiledNote = await noteService.create("Idea 1", "2026-10-12");
    const filedNote = await noteService.create("Idea 2", "2026-10-12", folder.id);

    expect(unfiledNote.folderId).toBeNull();
    expect(filedNote.folderId).toBe(folder.id);
  });

  it("moves note between folders and to Unfiled without changing content or timestamps", async () => {
    const folderService = new FolderService();
    const noteService = new NoteService();

    const f1 = await folderService.create("Folder 1");
    const f2 = await folderService.create("Folder 2");

    const note = await noteService.create("Important meeting notes #team", "2026-10-12", f1.id);
    const originalCreatedAt = note.createdAt;
    const originalUpdatedAt = note.updatedAt;
    const originalContent = note.content;

    // Move to Folder 2
    const moved = await noteService.moveToFolder(note.id, f2.id);
    expect(moved.folderId).toBe(f2.id);
    expect(moved.content).toBe(originalContent);
    expect(moved.createdAt).toBe(originalCreatedAt);
    expect(moved.updatedAt).toBe(originalUpdatedAt);

    // Move to Unfiled
    const unfiled = await noteService.moveToFolder(note.id, null);
    expect(unfiled.folderId).toBeNull();
    expect(unfiled.content).toBe(originalContent);
    expect(unfiled.createdAt).toBe(originalCreatedAt);
    expect(unfiled.updatedAt).toBe(originalUpdatedAt);
  });

  it("handles existing legacy notes without folderId property gracefully", async () => {
    const noteRepo = new NoteRepository();
    const noteService = new NoteService(noteRepo);

    // Insert raw note without folderId as existed in v1/v2 schema
    const legacyNote: Note = {
      id: "legacy-1",
      title: "Legacy Note",
      content: "Legacy content without folderId",
      tags: ["legacy"],
      noteDate: "2026-10-12",
      language: null,
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
      archived: false
    };
    await (await database()).put("notes", legacyNote);

    const retrieved = await noteService.get("legacy-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.folderId).toBeUndefined();

    // Assign to a folder
    const folderService = new FolderService();
    const folder = await folderService.create("Modern");
    const updated = await noteService.moveToFolder("legacy-1", folder.id);
    expect(updated.folderId).toBe(folder.id);
  });
});

describe("Atomic Folder Deletion & Note Preservation", () => {
  it("deleting a folder never deletes notes and reassigns them to Unfiled atomically", async () => {
    const folderService = new FolderService();
    const noteService = new NoteService();

    const folderA = await folderService.create("Folder A");
    const folderB = await folderService.create("Folder B");

    const note1 = await noteService.create("Note in A 1", "2026-10-12", folderA.id);
    const note2 = await noteService.create("Note in A 2", "2026-10-12", folderA.id);
    const noteB = await noteService.create("Note in B", "2026-10-12", folderB.id);
    const unfiled = await noteService.create("Unfiled note", "2026-10-12", null);

    // Delete Folder A
    await folderService.delete(folderA.id);

    // Folder A is gone
    expect(await folderService.get(folderA.id)).toBeUndefined();
    // Folder B still exists
    expect(await folderService.get(folderB.id)).toBeDefined();

    // Notes 1 and 2 are preserved with folderId: null
    const fresh1 = await noteService.get(note1.id);
    const fresh2 = await noteService.get(note2.id);
    expect(fresh1).toBeDefined();
    expect(fresh1?.content).toBe("Note in A 1");
    expect(fresh1?.folderId).toBeNull();

    expect(fresh2).toBeDefined();
    expect(fresh2?.content).toBe("Note in A 2");
    expect(fresh2?.folderId).toBeNull();

    // Note B and unfiled note are unaffected
    const freshB = await noteService.get(noteB.id);
    expect(freshB?.folderId).toBe(folderB.id);

    const freshUnfiled = await noteService.get(unfiled.id);
    expect(freshUnfiled?.folderId).toBeNull();
  });
});

describe("Backups, Imports & Exports", () => {
  it("parses and restores old backups without folders", async () => {
    const oldBackup: RookBackupV1 = {
      schemaVersion: 1,
      exportedAt: "2026-09-01T00:00:00.000Z",
      application: { name: "rook-lite", version: "1.5.0" },
      notes: [
        {
          id: "old-1",
          title: "Old note",
          content: "Old content",
          tags: ["archive"],
          noteDate: "2026-09-01",
          language: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
          archived: false
        }
      ],
      summaries: [],
      settings: []
    };

    const parsed = parseBackup(JSON.stringify(oldBackup));
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.folders).toBeUndefined();

    await restoreBackup(parsed);
    const noteService = new NoteService();
    const restoredNotes = await noteService.listAll();
    expect(restoredNotes).toHaveLength(1);
    expect(restoredNotes[0].id).toBe("old-1");
  });

  it("preserves folders and note assignments on round-trip backup and restore", async () => {
    const folderService = new FolderService();
    const noteService = new NoteService();

    const folder = await folderService.create("Finance");
    await noteService.create("Tax report 2026", "2026-10-12", folder.id);
    await noteService.create("Grocery list", "2026-10-12", null);

    const backup = await createBackup();
    expect(backup.folders).toBeDefined();
    expect(backup.folders).toHaveLength(1);
    expect(backup.folders?.[0].name).toBe("Finance");

    const json = JSON.stringify(backup);
    const parsed = parseBackup(json);
    expect(parsed.folders).toHaveLength(1);

    await clearAllData();
    await restoreBackup(parsed);

    const restoredFolders = await folderService.listAll();
    expect(restoredFolders).toHaveLength(1);
    expect(restoredFolders[0].name).toBe("Finance");

    const restoredNotes = await noteService.listAll();
    expect(restoredNotes).toHaveLength(2);
    const taxNote = restoredNotes.find((n) => n.title === "Tax report 2026");
    expect(taxNote?.folderId).toBe(folder.id);
    const groceryNote = restoredNotes.find((n) => n.title === "Grocery list");
    expect(groceryNote?.folderId).toBeNull();
  });

  it("normalizes note folderId to null if backup note points to non-existent folder", async () => {
    const corruptedBackup: RookBackupV1 = {
      schemaVersion: 1,
      exportedAt: "2026-10-12T00:00:00.000Z",
      application: { name: "rook-lite", version: "1.6.0" },
      folders: [
        {
          id: "folder-valid",
          name: "Valid Folder",
          createdAt: "2026-10-12T00:00:00.000Z",
          updatedAt: "2026-10-12T00:00:00.000Z"
        }
      ],
      notes: [
        {
          id: "note-1",
          title: "Note with missing folder",
          content: "Content",
          tags: [],
          noteDate: "2026-10-12",
          folderId: "folder-deleted-or-missing",
          language: null,
          createdAt: "2026-10-12T00:00:00.000Z",
          updatedAt: "2026-10-12T00:00:00.000Z",
          archived: false
        }
      ],
      summaries: [],
      settings: []
    };

    const parsed = parseBackup(JSON.stringify(corruptedBackup));
    await restoreBackup(parsed);

    const note = await new NoteService().get("note-1");
    expect(note).toBeDefined();
    expect(note?.folderId).toBeNull();
  });

  it("exports markdown with frontmatter folder metadata without altering directory path structure", async () => {
    const folder: Folder = {
      id: "f-work",
      name: "Client Work",
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z"
    };
    const noteWithFolder: Note = {
      id: "note-abc12345",
      title: "Contract Review",
      content: "Details about client agreement",
      tags: ["legal"],
      noteDate: "2026-10-12",
      folderId: "f-work",
      language: null,
      createdAt: "2026-10-12T10:00:00.000Z",
      updatedAt: "2026-10-12T10:00:00.000Z",
      archived: false
    };
    const unfiledNote: Note = {
      id: "note-xyz67890",
      title: "Quick Thought",
      content: "Random thought",
      tags: [],
      noteDate: "2026-10-12",
      folderId: null,
      language: null,
      createdAt: "2026-10-12T11:00:00.000Z",
      updatedAt: "2026-10-12T11:00:00.000Z",
      archived: false
    };

    const foldersMap = new Map([[folder.id, folder]]);
    const fileWithFolder = markdownFile(noteWithFolder, foldersMap);
    const fileUnfiled = markdownFile(unfiledNote, foldersMap);

    expect(fileWithFolder.path).toMatch(/^2026\/10\/week-\d+\/2026-10-12-contract-review-note-abc\.md$/);
    expect(fileWithFolder.content).toContain('folder: "Client Work"');

    expect(fileUnfiled.path).toMatch(/^2026\/10\/week-\d+\/2026-10-12-quick-thought-note-xyz\.md$/);
    expect(fileUnfiled.content).not.toContain("folder:");
  });
});

describe("Summaries Default Scope", () => {
  it("includes notes across all folders and unfiled notes in summary engine", async () => {
    const folderService = new FolderService();
    const noteService = new NoteService();

    const folder = await folderService.create("Q4 Planning");
    await noteService.create("# Goal 1\nExecute launch plan", "2026-10-12", folder.id);
    await noteService.create("# Goal 2\nRefactor database layer", "2026-10-12", null);

    const allNotes = await noteService.listAll();
    const engine = new RuleBasedSummaryEngine();
    const period = summaryPeriod("weekly", "2026-10-12");
    const summary = await engine.generate(allNotes, period);

    expect(summary.markdown).toContain("Goal 1");
    expect(summary.markdown).toContain("Goal 2");
  });
});

describe("UI Folder Filtering & Workflows", () => {
  it("hides section-head on empty days and renders folder filter dropdown when notes exist", async () => {
    const host = document.createElement("div");
    host.id = "app";
    document.body.appendChild(host);

    await renderShell();
    // On an empty day, section-head and folder-picker must be completely hidden
    expect(document.querySelector(".section-head")).toBeNull();
    expect(document.querySelector("#folder-picker")).toBeNull();

    // Create a note for today
    const noteService = new NoteService();
    const today = (new Date()).toISOString().slice(0, 10);
    await noteService.create("A note for today", today, null);

    const pageContent = document.querySelector<HTMLElement>("#page-content")!;
    await renderToday(pageContent);

    const folderPicker = document.querySelector<HTMLDetailsElement>("#folder-picker");
    expect(folderPicker).not.toBeNull();

    const activeLabel = folderPicker?.querySelector(".filter-btn-label");
    expect(activeLabel?.textContent).toBe("All notes");

    // Redundant dot button is removed from the filter bar
    expect(document.querySelector("#folder-context-menu")).toBeNull();
  });

  it("filters notes when viewing a folder and creates notes into that folder", async () => {
    const folderService = new FolderService();
    const noteService = new NoteService();

    const folder = await folderService.create("Design Tokens");
    await noteService.create("Typography system", "2026-10-12", folder.id);
    await noteService.create("Unfiled note content", "2026-10-12", null);

    // Navigate to folder
    history.replaceState({}, "", `/?date=2026-10-12&folder=${folder.id}`);
    const pageContent = document.querySelector<HTMLElement>("#page-content")!;
    await renderToday(pageContent);

    // Current folder dropdown label
    const folderPicker = document.querySelector<HTMLDetailsElement>("#folder-picker");
    const activeLabel = folderPicker?.querySelector(".filter-btn-label");
    expect(activeLabel?.textContent).toBe("Design Tokens");

    // Inline rename and delete buttons are directly accessible in the folder dropdown
    const inlineRename = folderPicker?.querySelector(`[data-action="rename-folder"][data-folder-id="${folder.id}"]`);
    expect(inlineRename).not.toBeNull();
    const inlineDelete = folderPicker?.querySelector(`[data-action="delete-folder"][data-folder-id="${folder.id}"]`);
    expect(inlineDelete).not.toBeNull();

    // Redundant dot button is removed from the filter bar
    expect(document.querySelector("#folder-context-menu")).toBeNull();

    // Only 1 note visible in this folder
    const notesList = document.querySelectorAll(".note");
    expect(notesList).toHaveLength(1);
    expect(notesList[0].textContent).toContain("Typography system");

    // Note card displays refined context badge
    const noteFolderBadge = notesList[0].querySelector(".note-folder-badge");
    expect(noteFolderBadge?.textContent).toContain("Design Tokens");

    // Editor pre-selects user folder
    const composerFolderInput = document.querySelector<HTMLInputElement>("#new-note-form input[name='folderId']");
    expect(composerFolderInput?.value).toBe(folder.id);
  });

  it("shows minimal empty state when folder has no notes", async () => {
    const folderService = new FolderService();
    const emptyFolder = await folderService.create("Empty Projects");

    history.replaceState({}, "", `/?date=2026-10-12&folder=${emptyFolder.id}`);
    const pageContent = document.querySelector<HTMLElement>("#page-content")!;
    await renderToday(pageContent);

    const emptyContainer = document.querySelector(".empty-notes");
    expect(emptyContainer).not.toBeNull();
    expect(emptyContainer?.textContent).toContain("No notes in this folder today");
  });

  it("supports multi-tag filtering without cluttering the bar", async () => {
    const noteService = new NoteService();
    await noteService.create("Contract #urgent #legal", "2026-10-14", null);
    await noteService.create("Bugfix #urgent #frontend", "2026-10-14", null);
    await noteService.create("Documentation #docs #frontend", "2026-10-14", null);

    // Filter by single tag ?tag=urgent
    history.replaceState({}, "", "/?date=2026-10-14&tag=urgent");
    const pageContent = document.querySelector<HTMLElement>("#page-content")!;
    await renderToday(pageContent);

    expect(document.querySelectorAll(".note")).toHaveLength(2);
    const tagPicker = document.querySelector<HTMLElement>("#tag-picker");
    expect(tagPicker?.querySelector(".filter-btn-label")?.textContent).toBe("urgent");

    // Filter by multiple tags ?tag=urgent,legal
    history.replaceState({}, "", "/?date=2026-10-14&tag=urgent,legal");
    await renderToday(pageContent);

    // Only notes with BOTH tags should be visible
    const notesList = document.querySelectorAll(".note");
    expect(notesList).toHaveLength(1);
    expect(notesList[0].textContent).toContain("Contract");

    // Multi-tag button displays label and count badge without duplicate counts
    const updatedTagPicker = document.querySelector<HTMLElement>("#tag-picker");
    expect(updatedTagPicker?.querySelector(".filter-btn-label")?.textContent).toBe("Tags");
    expect(updatedTagPicker?.querySelector(".filter-btn-badge")?.textContent).toBe("2");

    // Clear button is visible
    const clearBtn = document.querySelector<HTMLAnchorElement>(".filter-clear-btn");
    expect(clearBtn).not.toBeNull();

    // Inside the dropdown popover, both items are checked
    const checkedItems = document.querySelectorAll(".tag-popover-item.is-checked");
    expect(checkedItems).toHaveLength(2);

    // Verify tag picker preserves open state during multi-selection
    updatedTagPicker?.setAttribute("open", "");
    history.replaceState({}, "", "/?date=2026-10-14&tag=urgent");
    await renderToday(pageContent);
    const retainedTagPicker = document.querySelector<HTMLElement>("#tag-picker");
    expect(retainedTagPicker?.hasAttribute("open")).toBe(true);
  });
});
