// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Note } from "../models";
import { createCommandRegistry } from "./commandRegistry";
import { extractSnippet, searchPalette } from "./commandSearch";
import type { CommandContext, RecentCommand } from "./types";

const mockNotes: Note[] = [
  {
    id: "n-1",
    title: "Retry strategy investigation",
    content: "## Resilient HTTP\nWe should retry transient platform calls with exponential backoff.\n- [ ] Finish README cleanup\n#java #resilience",
    tags: ["java", "resilience"],
    noteDate: "2026-09-28",
    language: null,
    createdAt: "2026-09-28T10:00:00Z",
    updatedAt: "2026-09-28T10:00:00Z",
    archived: false
  },
  {
    id: "n-2",
    title: "Payment concurrency notes",
    content: "Idempotency keys and retry behavior for payment endpoints.\n- [ ] Investigate WebGPU fallback\n#rook",
    tags: ["rook"],
    noteDate: "2026-09-27",
    language: null,
    createdAt: "2026-09-27T10:00:00Z",
    updatedAt: "2026-09-27T10:00:00Z",
    archived: false
  },
  {
    id: "n-3",
    title: "JVM GC benchmarks",
    content: "ZGC vs Shenandoah pause times on macOS arm64.\n- [x] All tasks completed",
    tags: ["jvm"],
    noteDate: "2026-09-25",
    language: null,
    createdAt: "2026-09-25T10:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z",
    archived: false
  }
];

const mockContext: CommandContext = {
  currentPath: "/",
  currentDate: "2026-09-28",
  selectedNote: mockNotes[0],
  hasSummary: false
};

const dummyActions = {
  navigateTo: () => {},
  createNote: () => {},
  openDatePicker: () => {},
  shiftDate: () => {},
  openTasks: () => {},
  toggleTheme: () => {},
  setTheme: () => {},
  toggleZen: () => {},
  exportMarkdownZip: () => {},
  createBackup: () => {},
  triggerRestoreBackup: () => {}
};

describe("commandSearch", () => {
  const commands = createCommandRegistry(dummyActions);
  const recentCommands: RecentCommand[] = [
    { id: "review-this-week", lastUsedAt: Date.now(), useCount: 3 }
  ];

  it("returns contextual, quick, recent, and recent notes for empty query", () => {
    const sections = searchPalette("", commands, recentCommands, mockNotes, mockContext);
    const titles = sections.map((s) => s.title);

    expect(titles).toContain("Current Context");
    expect(titles).toContain("Quick");
    expect(titles).toContain("Recent Notes");

    const recentNotesSection = sections.find((s) => s.title === "Recent Notes");
    expect(recentNotesSection?.items.length).toBe(3);
  });

  it("filters commands in command mode (>)", () => {
    const sections = searchPalette(">export", commands, recentCommands, mockNotes, mockContext);
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("Commands");
    expect(sections[0].items.some((item) => item.id.includes("export"))).toBe(true);
  });

  it("filters notes with search query and highlights matching commands", () => {
    const sections = searchPalette("retry", commands, recentCommands, mockNotes, mockContext);
    const notesSection = sections.find((s) => s.title === "Notes");
    expect(notesSection).toBeDefined();
    expect(notesSection?.items.length).toBeGreaterThan(0);
    expect(notesSection?.items[0].id).toBe("n-1");
  });

  it("filters notes with structured tag filters", () => {
    const sections = searchPalette("tag:rook", commands, recentCommands, mockNotes, mockContext);
    const notesSection = sections.find((s) => s.title === "Notes");
    expect(notesSection?.items.length).toBe(1);
    expect(notesSection?.items[0].id).toBe("n-2");
  });

  it("extracts open tasks when has:task is queried", () => {
    const sections = searchPalette("has:task", commands, recentCommands, mockNotes, mockContext);
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("Open Tasks");
    expect(sections[0].items.length).toBe(2);
    expect((sections[0].items[0] as any).taskText).toBe("Finish README cleanup");
  });

  it("provides autocomplete suggestions for tag:", () => {
    const sections = searchPalette("notes tag:", commands, recentCommands, mockNotes, mockContext);
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("Tags");
    expect(sections[0].items.map((i: any) => i.value)).toContain("java");
    expect(sections[0].items.map((i: any) => i.value)).toContain("rook");
  });

  it("extracts readable snippet around search term", () => {
    const snippet = extractSnippet("First paragraph.\nWe should retry transient platform calls.\nEnd note.", "retry");
    expect(snippet).toContain("retry");
  });
});
