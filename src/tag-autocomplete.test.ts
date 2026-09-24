// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  attachTagAutocomplete,
  filterMatchingTags,
  getAutocompleteQuery,
  insertTagAtCursor
} from "./tag-autocomplete";

describe("tag autocomplete helpers", () => {
  it("extracts autocomplete query when cursor is after a hashtag", () => {
    expect(getAutocompleteQuery("Hello #w", 8)).toEqual({
      query: "w",
      startIndex: 6,
      endIndex: 8
    });

    expect(getAutocompleteQuery("Type #", 6)).toEqual({
      query: "",
      startIndex: 5,
      endIndex: 6
    });

    expect(getAutocompleteQuery("#first #second", 14)).toEqual({
      query: "second",
      startIndex: 7,
      endIndex: 14
    });
  });

  it("returns null when cursor is not immediately after a hashtag", () => {
    expect(getAutocompleteQuery("No hashtag here", 5)).toBeNull();
    expect(getAutocompleteQuery("#done and dusted ", 17)).toBeNull();
    expect(getAutocompleteQuery("email@example.com", 10)).toBeNull();
  });

  it("filters matching tags correctly", () => {
    const allTags: Array<[string, number]> = [
      ["work", 5],
      ["workout", 3],
      ["personal", 10],
      ["ideas", 2]
    ];

    expect(filterMatchingTags(allTags, "")).toHaveLength(4);
    expect(filterMatchingTags(allTags, "wo")).toEqual([
      ["work", 5],
      ["workout", 3]
    ]);
    expect(filterMatchingTags(allTags, "xyz")).toEqual([]);
  });

  it("replaces active hashtag query with selected tag and moves cursor", () => {
    const { text, newCursor } = insertTagAtCursor("Planning #w today", "work", 9, 11);
    expect(text).toBe("Planning #work  today");
    expect(newCursor).toBe(15);
  });

  it("attaches autocomplete dropdown and supports keyboard selection", async () => {
    const container = document.createElement("div");
    const textarea = document.createElement("textarea");
    container.appendChild(textarea);
    document.body.appendChild(container);

    const getTags = vi.fn().mockResolvedValue([
      ["work", 5],
      ["ideas", 2]
    ]);

    const detach = attachTagAutocomplete(textarea, getTags);

    // Type #
    textarea.value = "New note #";
    textarea.setSelectionRange(10, 10);
    textarea.dispatchEvent(new Event("input"));

    await new Promise((resolve) => setTimeout(resolve, 10));

    const dropdown = container.querySelector<HTMLElement>(".tag-autocomplete-dropdown");
    expect(dropdown).not.toBeNull();
    expect(dropdown?.style.display).toBe("block");

    const items = dropdown?.querySelectorAll(".tag-autocomplete-item");
    expect(items?.length).toBe(2);

    // Press enter to select first tag
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(textarea.value).toBe("New note #work ");
    expect(dropdown?.style.display).toBe("none");

    detach();
    container.remove();
  });
});
