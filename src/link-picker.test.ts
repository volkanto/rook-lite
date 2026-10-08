import { describe, expect, it } from "vitest";
import type { Note } from "./models";
import { buildWikilinkInsertion, extractCleanFirstLine, getLinkPickerCandidates } from "./link-picker";

describe("link picker single-line ledger", () => {
  const mockNotes: Note[] = [
    {
      id: "note-1",
      title: "Sprint Retrospective",
      content: "### Sprint Retrospective\nDiscussion on completed goals and next sprint roadmap.",
      tags: ["retro"],
      noteDate: "2026-10-01",
      language: null,
      createdAt: "2026-10-01T10:00:00Z",
      updatedAt: "2026-10-01T10:00:00Z",
      archived: false
    },
    {
      id: "note-2",
      title: "Design System Specs",
      content: "Tokens and color choices for minimal UI.",
      tags: ["design"],
      noteDate: "2026-09-28",
      language: null,
      createdAt: "2026-09-28T10:00:00Z",
      updatedAt: "2026-09-28T10:00:00Z",
      archived: false
    }
  ];

  it("extracts clean single summary line from markdown headers", () => {
    const line = extractCleanFirstLine("### Architecture Decision\nChosen indexedDB for storage.");
    expect(line).toBe("Architecture Decision");
  });

  it("filters notes into single-line ledger rows with badge, line, and tag", () => {
    const { notes } = getLinkPickerCandidates("goals", mockNotes);
    expect(notes).toHaveLength(1);
    expect(notes[0].line).toBe("Sprint Retrospective");
    expect(notes[0].badge).toBeDefined();
    expect(notes[0].tag).toBe("retro");
  });

  it("provides recent date ledger candidates", () => {
    const { dates } = getLinkPickerCandidates("", mockNotes);
    expect(dates.length).toBeGreaterThanOrEqual(1);
    expect(dates[0].type).toBe("date");
    expect(dates[0].badge).toBe("Today");
  });

  it("builds wikilink syntax with custom label when text is selected", () => {
    const syntax = buildWikilinkInsertion("Sprint Retrospective", "Retro notes");
    expect(syntax).toBe("[[Sprint Retrospective|Retro notes]]");
  });

  it("builds simple wikilink syntax when no text or matching text is selected", () => {
    expect(buildWikilinkInsertion("2026-10-02")).toBe("[[2026-10-02]]");
    expect(buildWikilinkInsertion("Sprint Retrospective", "Sprint Retrospective")).toBe("[[Sprint Retrospective]]");
  });
});
