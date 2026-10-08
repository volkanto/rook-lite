import { describe, expect, it } from "vitest";
import { insertFilterValue, parseSearchQuery } from "./searchParser";

describe("searchParser", () => {
  it("parses plain text query", () => {
    const parsed = parseSearchQuery("retry payment strategy");
    expect(parsed.text).toBe("retry payment strategy");
    expect(parsed.tags).toEqual([]);
    expect(parsed.hasTask).toBeUndefined();
    expect(parsed.after).toBeUndefined();
    expect(parsed.before).toBeUndefined();
    expect(parsed.activeFilter).toBeNull();
  });

  it("parses tag filters", () => {
    const parsed = parseSearchQuery("retry tag:java tag:#spring");
    expect(parsed.text).toBe("retry");
    expect(parsed.tags).toEqual(["java", "spring"]);
  });

  it("parses task filters with has:task and has:todo", () => {
    const parsedTask = parseSearchQuery("has:task urgent");
    expect(parsedTask.text).toBe("urgent");
    expect(parsedTask.hasTask).toBe(true);

    const parsedTodo = parseSearchQuery("review has:todo");
    expect(parsedTodo.text).toBe("review");
    expect(parsedTodo.hasTask).toBe(true);
  });

  it("parses date filters (after, before)", () => {
    const parsed = parseSearchQuery("after:2026-09-01 before:2026-09-30 deploy");
    expect(parsed.text).toBe("deploy");
    expect(parsed.after).toBe("2026-09-01");
    expect(parsed.before).toBe("2026-09-30");
  });

  it("handles invalid date formats gracefully without treating them as valid dates", () => {
    const parsed = parseSearchQuery("after:invalid-date before:2026-99-999");
    expect(parsed.after).toBeUndefined();
    expect(parsed.before).toBeUndefined();
  });

  it("combines multiple filters correctly", () => {
    const parsed = parseSearchQuery("retry tag:java has:task after:2026-09-01");
    expect(parsed.text).toBe("retry");
    expect(parsed.tags).toEqual(["java"]);
    expect(parsed.hasTask).toBe(true);
    expect(parsed.after).toBe("2026-09-01");
  });

  it("ignores unknown filter syntax as regular text search", () => {
    const parsed = parseSearchQuery("project:apollo priority:high");
    expect(parsed.text).toBe("project:apollo priority:high");
  });

  it("detects active filter token at end of query for autocomplete", () => {
    const parsedTag = parseSearchQuery("notes tag:");
    expect(parsedTag.activeFilter).toEqual({
      type: "tag",
      value: "",
      startIndex: 6
    });

    const parsedTagPrefix = parseSearchQuery("notes tag:jav");
    expect(parsedTagPrefix.activeFilter).toEqual({
      type: "tag",
      value: "jav",
      startIndex: 6
    });
  });

  it("inserts filter value replacing active token or appending", () => {
    expect(insertFilterValue("notes tag:jav", "tag", "java")).toBe("notes tag:java ");
    expect(insertFilterValue("notes", "tag", "learning")).toBe("notes tag:learning ");
  });
});
