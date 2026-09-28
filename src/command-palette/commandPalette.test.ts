// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Note } from "../models";
import { CommandPaletteController } from "./commandPalette";
import type { CommandActions, CommandContext } from "./types";

describe("CommandPaletteController", () => {
  let host: HTMLElement;
  let actions: CommandActions;
  let mockContext: CommandContext;
  let controller: CommandPaletteController;

  const mockNotes: Note[] = [
    {
      id: "note-1",
      title: "Rook Lite roadmap",
      content: "Roadmap details for local-first markdown note taking.\n- [ ] Task 1",
      categoryIds: ["cat-work"],
      tags: ["roadmap", "rook"],
      noteDate: "2026-09-28",
      language: null,
      createdAt: "2026-09-28T10:00:00Z",
      updatedAt: "2026-09-28T10:00:00Z",
      archived: false
    }
  ];

  const mockCategories: Category[] = [
    {
      id: "cat-work",
      name: "Work",
      slug: "work",
      color: "#6366F1",
      sortOrder: 0,
      archived: false,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z"
    }
  ];

  beforeEach(() => {
    document.body.innerHTML = '<div id="search-modal" class="modal-backdrop"></div>';
    host = document.getElementById("search-modal")!;

    actions = {
      navigateTo: vi.fn(),
      createNote: vi.fn(),
      openDatePicker: vi.fn(),
      shiftDate: vi.fn(),
      openTasks: vi.fn(),
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
      toggleZen: vi.fn(),
      exportMarkdownZip: vi.fn(),
      createBackup: vi.fn(),
      triggerRestoreBackup: vi.fn()
    };

    mockContext = {
      currentPath: "/",
      currentDate: "2026-09-28"
    };

    controller = new CommandPaletteController({
      hostElement: host,
      getNotes: async () => mockNotes,
      getCategories: async () => mockCategories,
      getContext: () => mockContext,
      actions
    });
  });

  it("initializes with combobox and hidden state", () => {
    expect(controller.isOpen()).toBe(false);
    expect(host.classList.contains("is-open")).toBe(false);
    const input = host.querySelector<HTMLInputElement>("#command-palette-input");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("role")).toBe("combobox");
  });

  it("opens palette and renders quick actions and notes", async () => {
    await controller.open();
    expect(controller.isOpen()).toBe(true);
    expect(host.classList.contains("is-open")).toBe(true);

    const items = host.querySelectorAll(".palette-item");
    expect(items.length).toBeGreaterThan(0);
  });

  it("switches to command mode with > prefix", async () => {
    await controller.open(">");
    const commandsTitle = host.querySelector(".palette-group-title");
    expect(commandsTitle?.textContent).toContain("Commands");
  });

  it("navigates results with keyboard arrow keys and selects with Enter", async () => {
    await controller.open(">");
    const input = host.querySelector<HTMLInputElement>("#command-palette-input")!;

    // Arrow down to move to next item
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    let activeItem = host.querySelector(".palette-item.is-active");
    expect(activeItem).not.toBeNull();

    // Press Enter to execute command
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(controller.isOpen()).toBe(false);
  });

  it("closes palette on Escape key", async () => {
    await controller.open();
    expect(controller.isOpen()).toBe(true);

    const input = host.querySelector<HTMLInputElement>("#command-palette-input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(controller.isOpen()).toBe(false);
    expect(host.classList.contains("is-open")).toBe(false);
  });

  it("inserts filter value on autocomplete suggestion selection", async () => {
    await controller.open("tag:");
    const input = host.querySelector<HTMLInputElement>("#command-palette-input")!;

    const suggestion = host.querySelector<HTMLElement>(".palette-suggestion-item");
    expect(suggestion).not.toBeNull();

    suggestion?.click();
    expect(input.value).toContain("tag:");
    expect(controller.isOpen()).toBe(true); // Stays open to continue searching
  });
});
