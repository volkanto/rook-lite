// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

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

import { database, NoteRepository } from "../db";
import { NoteService } from "../services";

function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("Command Palette Integration", () => {
  beforeEach(async () => {
    const db = await database();
    await db.clear("notes");
    await db.clear("drafts");
    await db.clear("categories");
    await db.clear("settings");
    document.body.innerHTML = '<div id="app"></div>';
  });

  it("opens palette on ⌘K / Ctrl+K and displays quick actions and recent notes", async () => {
    const { renderShell, openSearch } = await import("../main");
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    await noteService.create("First roadmap note\n- [ ] Ship unified command palette\n#roadmap #rook", today, []);

    await renderShell();
    await openSearch();

    const modal = document.querySelector<HTMLElement>("#search-modal");
    expect(modal?.classList.contains("is-open")).toBe(true);

    const input = document.querySelector<HTMLInputElement>("#command-palette-input");
    expect(input).not.toBeNull();
    expect(input?.placeholder).toContain("Search notes or type > for commands");

    const items = modal?.querySelectorAll(".palette-item");
    expect(items && items.length > 0).toBe(true);

    // Escape closes palette
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(modal?.classList.contains("is-open")).toBe(false);
  });

  it("enters command mode when typing > and executes commands", async () => {
    const { renderShell, openSearch } = await import("../main");
    await renderShell();
    await openSearch();

    const modal = document.querySelector<HTMLElement>("#search-modal");
    expect(modal?.classList.contains("is-open")).toBe(true);

    const input = document.querySelector<HTMLInputElement>("#command-palette-input")!;
    input.value = ">";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 20));

    const modeTag = modal?.querySelector(".mode-tag-command");
    expect(modeTag?.textContent).toContain("Command Mode");

    // Filter to new note
    input.value = ">new note";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    const activeItem = modal?.querySelector(".palette-item.palette-command-item");
    expect(activeItem?.textContent).toContain("New note");

    // Press Enter to execute
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(modal?.classList.contains("is-open")).toBe(false);
  });

  it("extracts and displays open tasks when has:task is searched", async () => {
    const { renderShell, openSearch } = await import("../main");
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    await noteService.create("Sprint tasks\n- [ ] Finish palette UI\n- [x] Write parser", today, []);

    await renderShell();
    await openSearch("has:task");

    const modal = document.querySelector<HTMLElement>("#search-modal");
    const taskTitle = modal?.querySelector(".palette-group-title");
    expect(taskTitle?.textContent).toContain("Open Tasks");

    const taskItem = modal?.querySelector(".palette-task-item");
    expect(taskItem?.textContent).toContain("Finish palette UI");
  });

  it("provides autocomplete suggestions for tag: and inserts on click", async () => {
    const { renderShell, openSearch } = await import("../main");
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    await noteService.create("Tagged note\n#productivity", today, []);

    await renderShell();
    await openSearch("tag:");

    const modal = document.querySelector<HTMLElement>("#search-modal");
    const suggestionTitle = modal?.querySelector(".palette-group-title");
    expect(suggestionTitle?.textContent).toContain("Tags");

    const suggestionItem = modal?.querySelector<HTMLElement>(".palette-suggestion-item");
    expect(suggestionItem?.textContent).toContain("#productivity");

    // Clicking suggestion inserts tag:productivity into input
    suggestionItem?.click();
    const input = document.querySelector<HTMLInputElement>("#command-palette-input")!;
    expect(input.value).toContain("tag:productivity");
  });

  it("navigates to note and triggers blink highlight when note is selected from search", async () => {
    const { renderShell, openSearch } = await import("../main");
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Blinking search target note\n#search", today, []);

    await renderShell();
    await openSearch("Blinking search");

    const modal = document.querySelector<HTMLElement>("#search-modal");
    const noteItem = modal?.querySelector<HTMLElement>(".palette-note-item");
    expect(noteItem).not.toBeNull();

    // Select the note
    noteItem?.click();

    // Verify modal is closed
    expect(modal?.classList.contains("is-open")).toBe(false);

    // Verify target note element in stream exists
    const noteEl = document.querySelector<HTMLElement>(`#note-${createdNote.id}`);
    expect(noteEl).not.toBeNull();

    // Wait for async renderRoute and requestAnimationFrame to apply is-search-target
    await new Promise((r) => setTimeout(r, 250));
    const targetEl = document.querySelector<HTMLElement>(`#note-${createdNote.id}`);
    expect(targetEl?.classList.contains("is-search-target")).toBe(true);
  });
});
