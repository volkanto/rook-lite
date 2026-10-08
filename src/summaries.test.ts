// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { Note } from "./models";
import { assertLocalEndpoint, DEFAULT_OLLAMA_PROMPT, generateRuleBasedSummary, OllamaSummaryEngine, summaryPeriod } from "./summaries";

// Ensure JSDOM environment has required globals before importing main.ts
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

const note: Note = { id: "note-1", title: "Retry improvements", content: "## Retry improvements\n- Implemented retry handling improvements.\n- Investigated latency.", tags: ["retry"], noteDate: "2026-09-19", language: "en", createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-19T00:00:00Z", archived: false };

describe("rule-based summaries", () => {
  it("is deterministic and grouped by tag", () => {
    const period = { type: "weekly" as const, start: "2026-09-14", end: "2026-09-20" };
    const first = generateRuleBasedSummary([note], period);
    expect(first).toBe(generateRuleBasedSummary([note], period));
    expect(first).toContain("## #retry");
    expect(first).toContain("Implemented retry handling improvements.");
  });

  it("handles an empty period", () => {
    expect(generateRuleBasedSummary([], { type: "weekly", start: "2026-09-14", end: "2026-09-20" })).toContain("No notes");
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

describe("OllamaSummaryEngine system prompt", () => {
  it("uses custom system prompt when provided", async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ message: { content: "Custom summary result" } }));
    });

    const engine = new OllamaSummaryEngine({
      enabled: true,
      endpoint: "http://localhost:11434",
      model: "llama3.2",
      temperature: 0.2,
      timeoutMs: 5000,
      systemPrompt: "You are a concise executive summary bot."
    });

    const period = { type: "weekly" as const, start: "2026-09-14", end: "2026-09-20" };
    const result = await engine.generate([note], period);
    expect(result.markdown).toContain("Custom summary result");
    expect(capturedBody.messages[0]).toEqual({ role: "system", content: "You are a concise executive summary bot." });
  });

  it("falls back to DEFAULT_OLLAMA_PROMPT when system prompt is empty or omitted", async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ message: { content: "Default prompt result" } }));
    });

    const engine = new OllamaSummaryEngine({
      enabled: true,
      endpoint: "http://localhost:11434",
      model: "llama3.2",
      temperature: 0.2,
      timeoutMs: 5000,
      systemPrompt: "   "
    });

    const period = { type: "weekly" as const, start: "2026-09-14", end: "2026-09-20" };
    await engine.generate([note], period);
    expect(capturedBody.messages[0]).toEqual({ role: "system", content: DEFAULT_OLLAMA_PROMPT });
  });
});

describe("summary mode picker and local AI setting", () => {
  it("disables AI option visually on summaries page", async () => {
    const { renderSummariesV2 } = await import("./main");

    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSummariesV2(container);

    const ollamaRadio = container.querySelector<HTMLInputElement>('input[name="mode"][value="ollama"]');
    expect(ollamaRadio).not.toBeNull();
    expect(ollamaRadio?.disabled).toBe(true);

    const ollamaLabel = ollamaRadio?.closest("label");
    expect(ollamaLabel?.classList.contains("is-disabled")).toBe(true);

    const ruleBasedRadio = container.querySelector<HTMLInputElement>('input[name="mode"][value="rule-based"]');
    expect(ruleBasedRadio?.disabled).toBe(false);
    expect(ruleBasedRadio?.checked).toBe(true);

    container.remove();
  });

  it("renders summary period tabs with proper active and selected states", async () => {
    const { renderSummariesV2 } = await import("./main");

    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSummariesV2(container);

    const tabs = container.querySelector(".summary-period-tabs");
    expect(tabs).not.toBeNull();
    expect(tabs?.getAttribute("role")).toBe("tablist");

    const weeklyBtn = container.querySelector<HTMLButtonElement>('button[data-summary-type="weekly"]');
    const monthlyBtn = container.querySelector<HTMLButtonElement>('button[data-summary-type="monthly"]');
    const customBtn = container.querySelector<HTMLButtonElement>('button[data-summary-type="custom"]');

    expect(weeklyBtn).not.toBeNull();
    expect(monthlyBtn).not.toBeNull();
    expect(customBtn).not.toBeNull();

    // By default, weekly is selected
    expect(weeklyBtn?.classList.contains("is-active")).toBe(true);
    expect(weeklyBtn?.getAttribute("aria-pressed")).toBe("true");
    expect(weeklyBtn?.getAttribute("aria-selected")).toBe("true");

    expect(monthlyBtn?.classList.contains("is-active")).toBe(false);
    expect(customBtn?.classList.contains("is-active")).toBe(false);

    container.remove();
  });
});
