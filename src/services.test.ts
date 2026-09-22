import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { CategoryRepository, clearAllData, NoteRepository } from "./db";
import { deriveTitle, extractTags } from "./markdown";
import { CategoryService, normalize, NoteService, slugify } from "./services";

beforeEach(async () => clearAllData());

describe("markdown metadata", () => {
  it("derives titles and excludes headings and code from tags", () => {
    expect(deriveTitle("# Architecture\nBody #rook")).toBe("Architecture");
    expect(extractTags("# Heading\nBody #Rook `#ignored`\n```\n#also-ignored\n```"))
      .toEqual(["rook"]);
  });
});

describe("normalization", () => {
  it("normalizes case and diacritics and produces stable slugs", () => {
    expect(normalize("GÖRÜŞME")).toBe("gorusme");
    expect(slugify("Team Learning")).toBe("team-learning");
  });
});

describe("local repositories", () => {
  it("creates and retrieves a note by date", async () => {
    const service = new NoteService(new NoteRepository());
    const note = await service.create("## Retry improvements\n#engineering", "2026-09-19", []);
    expect(note.title).toBe("Retry improvements");
    expect(note.tags).toEqual(["engineering"]);
    expect(await service.listByDate("2026-09-19")).toHaveLength(1);
  });

  it("completes exactly the selected Markdown task", async () => {
    const service = new NoteService(new NoteRepository());
    const note = await service.create("- [ ] first\n- [ ] second", "2026-09-19", []);
    const updated = await service.setTaskDone(note.id, 1, true);
    expect(updated.content).toBe("- [ ] first\n- [x] second");
  });

  it("deletes a category and detaches it from notes", async () => {
    const categoryService = new CategoryService(new CategoryRepository());
    const category = await categoryService.create("Engineering");
    const noteService = new NoteService(new NoteRepository());
    const note = await noteService.create("Work", "2026-09-19", [category.id]);
    await categoryService.delete(category.id);
    expect((await noteService.listAll()).find((item) => item.id === note.id)?.categoryIds).toEqual([]);
  });
});
