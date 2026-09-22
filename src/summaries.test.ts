// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Category, Note } from "./models";
import { assertLocalEndpoint, generateRuleBasedSummary, summaryPeriod } from "./summaries";

const category: Category = { id: "engineering", name: "Engineering", slug: "engineering", color: "#000", sortOrder: 0, archived: false, createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-19T00:00:00Z" };
const note: Note = { id: "note-1", title: "Retry improvements", content: "## Retry improvements\n- Implemented retry handling improvements.\n- Investigated latency.", categoryIds: [category.id], tags: ["retry"], noteDate: "2026-09-19", language: "en", createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-19T00:00:00Z", archived: false };

describe("rule-based summaries", () => {
  it("is deterministic and grouped by category", () => {
    const period = { type: "weekly" as const, start: "2026-09-14", end: "2026-09-20" };
    const first = generateRuleBasedSummary([note], [category], period);
    expect(first).toBe(generateRuleBasedSummary([note], [category], period));
    expect(first).toContain("## Engineering");
    expect(first).toContain("Implemented retry handling improvements.");
  });

  it("handles an empty period", () => {
    expect(generateRuleBasedSummary([], [], { type: "weekly", start: "2026-09-14", end: "2026-09-20" })).toContain("No notes");
  });
});

describe("Ollama endpoint privacy", () => {
  it("accepts loopback and rejects remote hosts", () => {
    expect(() => assertLocalEndpoint("http://localhost:11434")).not.toThrow();
    expect(() => assertLocalEndpoint("https://api.example.com")).toThrow(/only allows local/);
  });
});

describe("summary periods", () => {
  it("uses ISO Monday through Sunday for weekly periods", () => {
    expect(summaryPeriod("weekly", "2026-09-19")).toEqual({ type: "weekly", start: "2026-09-14", end: "2026-09-20" });
  });

  it("calculates month and custom date boundaries", () => {
    expect(summaryPeriod("monthly", "2026-02-15")).toEqual({ type: "monthly", start: "2026-02-01", end: "2026-02-28" });
    expect(summaryPeriod("custom", "2026-09-01", "2026-09-19")).toEqual({ type: "custom", start: "2026-09-01", end: "2026-09-19" });
  });
});
