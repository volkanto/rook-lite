// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Note, RookBackupV1 } from "./models";
import { markdownFile, parseBackup } from "./data";

const note: Note = { id: "12345678-1234", title: "Retry improvements", content: "Details", categoryIds: [], tags: ["rook"], noteDate: "2026-09-17", language: "en", createdAt: "2026-09-17T08:00:00Z", updatedAt: "2026-09-17T09:00:00Z", archived: false };

describe("Markdown export", () => {
  it("uses calendar hierarchy and ISO week", () => {
    const file = markdownFile(note, []);
    expect(file.path).toBe("2026/09/week-38/2026-09-17-retry-improvements-12345678.md");
    expect(file.content).toContain("isoWeek: 38");
    expect(file.content).toContain('id: "12345678-1234"');
  });
});

describe("backup validation", () => {
  it("accepts a complete v1 backup and rejects malformed input", () => {
    const backup: RookBackupV1 = { schemaVersion: 1, exportedAt: "2026-09-19T00:00:00Z", application: { name: "rook-lite", version: "0.1.0" }, notes: [note], categories: [], summaries: [], settings: [] };
    expect(parseBackup(JSON.stringify(backup)).notes).toHaveLength(1);
    expect(() => parseBackup("not json")).toThrow(/valid JSON/);
  });
});
