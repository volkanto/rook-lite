import { describe, expect, it } from "vitest";
import type { Note } from "./models";
import {
  extractSnippetAroundTarget,
  extractWikilinks,
  findDateBacklinks,
  findNoteBacklinks,
  renderWikilinkHtml,
  setWikilinkNotesIndex
} from "./wikilinks";

describe("wikilinks", () => {
  describe("extractWikilinks", () => {
    it("extracts simple date wikilinks", () => {
      const links = extractWikilinks("Meeting notes from [[2026-10-02]] discussing specs.");
      expect(links).toHaveLength(1);
      expect(links[0].target).toBe("2026-10-02");
      expect(links[0].label).toBe("2026-10-02");
      expect(links[0].isDate).toBe(true);
      expect(links[0].date).toBe("2026-10-02");
    });

    it("extracts wikilinks with custom labels and anchors", () => {
      const links = extractWikilinks("Refer to [[2026-10-02#note-123|Friday standup]] and [[Project Titan]].");
      expect(links).toHaveLength(2);

      expect(links[0].target).toBe("2026-10-02");
      expect(links[0].anchor).toBe("note-123");
      expect(links[0].label).toBe("Friday standup");
      expect(links[0].isDate).toBe(true);

      expect(links[1].target).toBe("Project Titan");
      expect(links[1].label).toBe("Project Titan");
      expect(links[1].isDate).toBe(false);
    });

    it("ignores wikilinks inside code blocks and inline code", () => {
      const md = `
Here is a real link: [[2026-10-05]]
\`\`\`
Ignore [[2026-10-06]] inside code block
\`\`\`
And ignore \`[[2026-10-07]]\` inline.
`;
      const links = extractWikilinks(md);
      expect(links).toHaveLength(1);
      expect(links[0].target).toBe("2026-10-05");
    });
  });

  describe("renderWikilinkHtml", () => {
    it("renders date wikilinks with SPA data-link and target date", () => {
      const html = renderWikilinkHtml("2026-10-02", "Friday Notes");
      expect(html).toContain('href="/?date=2026-10-02"');
      expect(html).toContain('data-link');
      expect(html).toContain('class="wikilink wikilink-date"');
      expect(html).toContain(">Friday Notes</a>");
    });

    it("renders date wikilinks with anchor", () => {
      const html = renderWikilinkHtml("2026-10-02#note-xyz", "Task details");
      expect(html).toContain('href="/?date=2026-10-02#note-xyz"');
      expect(html).toContain(">Task details</a>");
    });

    it("renders note wikilinks linking directly to note date and anchor", () => {
      setWikilinkNotesIndex([
        {
          id: "titan-1",
          title: "Project Titan",
          content: "Specs",
          tags: [],
          noteDate: "2026-09-20",
          language: null,
          createdAt: "2026-09-20T10:00:00Z",
          updatedAt: "2026-09-20T10:00:00Z",
          archived: false
        }
      ]);

      const html = renderWikilinkHtml("Project Titan");
      expect(html).toContain('href="/?date=2026-09-20#note-titan-1"');
      expect(html).toContain('class="wikilink wikilink-note"');
      expect(html).toContain(">Project Titan</a>");
    });
  });

  describe("extractSnippetAroundTarget", () => {
    it("extracts the line containing the target", () => {
      const content = "Introduction\nDiscussed requirements with Alice in [[2026-10-01]].\nConclusion";
      const snippet = extractSnippetAroundTarget(content, "[[2026-10-01]]");
      expect(snippet).toBe("Discussed requirements with Alice in [[2026-10-01]].");
    });
  });

  describe("findNoteBacklinks and findDateBacklinks", () => {
    const noteA: Note = {
      id: "note-a",
      title: "Project Titan Kickoff",
      content: "Started project architecture.",
      tags: ["project"],
      noteDate: "2026-10-01",
      language: null,
      createdAt: "2026-10-01T09:00:00Z",
      updatedAt: "2026-10-01T09:00:00Z",
      archived: false
    };

    const noteB: Note = {
      id: "note-b",
      title: "Design Review",
      content: "Reviewed deliverables from [[2026-10-01]] and aligned with [[Project Titan Kickoff]].",
      tags: [],
      noteDate: "2026-10-03",
      language: null,
      createdAt: "2026-10-03T10:00:00Z",
      updatedAt: "2026-10-03T10:00:00Z",
      archived: false
    };

    const noteC: Note = {
      id: "note-c",
      title: "Weekly Summary",
      content: "Mentioning [[note-a]] directly.",
      tags: [],
      noteDate: "2026-10-04",
      language: null,
      createdAt: "2026-10-04T12:00:00Z",
      updatedAt: "2026-10-04T12:00:00Z",
      archived: false
    };

    const allNotes = [noteA, noteB, noteC];

    it("finds backlinks to noteA from noteB (via date & title) and noteC (via noteId)", () => {
      const backlinks = findNoteBacklinks(noteA, allNotes);
      expect(backlinks).toHaveLength(2);
      expect(backlinks.map((b) => b.sourceNote.id)).toContain("note-b");
      expect(backlinks.map((b) => b.sourceNote.id)).toContain("note-c");
    });

    it("finds date backlinks pointing to 2026-10-01 from other days", () => {
      const backlinks = findDateBacklinks("2026-10-01", allNotes);
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].sourceNote.id).toBe("note-b");
      expect(backlinks[0].snippet).toContain("[[2026-10-01]]");
    });
  });
});
