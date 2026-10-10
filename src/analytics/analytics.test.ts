// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_ANALYTICS_EVENTS,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
  track,
  type AnalyticsEvent
} from "./analytics";
import { settingsRepository } from "../data";
import { APP_VERSION } from "../version";
import { database } from "../db";

describe("Frontend Analytics Service", () => {
  beforeEach(async () => {
    const db = await database();
    await db.clear("settings");
    vi.restoreAllMocks();
  });

  it("defaults analyticsEnabled to false (OFF)", async () => {
    const enabled = await isAnalyticsEnabled();
    expect(enabled).toBe(false);
  });

  it("persists analyticsEnabled setting using settingsRepository", async () => {
    await setAnalyticsEnabled(true);
    expect(await isAnalyticsEnabled()).toBe(true);
    expect(await settingsRepository.get("analyticsEnabled")).toBe(true);

    await setAnalyticsEnabled(false);
    expect(await isAnalyticsEnabled()).toBe(false);
    expect(await settingsRepository.get("analyticsEnabled")).toBe(false);
  });

  it("makes no network request when analytics are disabled", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await setAnalyticsEnabled(false);
    await track("note_created");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends POST to /api/analytics with only event and version when analytics are enabled", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);

    await setAnalyticsEnabled(true);
    await track("note_created");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/analytics");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      event: "note_created",
      version: APP_VERSION
    });
    // Ensure no additional fields exist
    expect(Object.keys(payload).sort()).toEqual(["event", "version"]);
  });

  it("does not propagate error when network request fails (rejection)", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("Network error"));
    vi.stubGlobal("fetch", fetchSpy);

    await setAnalyticsEnabled(true);

    // Should not throw
    await expect(track("command_palette_opened")).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not propagate error or retry when server returns HTTP 500 error", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("Internal error", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);

    await setAnalyticsEnabled(true);

    await expect(track("template_used")).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("enforces API design: does not accept arbitrary metadata arguments", () => {
    // Check that function arity is exactly 1 (only accepts event)
    expect(track.length).toBe(1);

    // If extra argument is passed at runtime, it is not included in the payload
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);

    return setAnalyticsEnabled(true).then(async () => {
      // @ts-expect-error Testing arbitrary metadata argument passed to track
      await track("note_created", { sensitiveContent: "should not be sent" });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(payload).toEqual({
        event: "note_created",
        version: APP_VERSION
      });
      expect(payload.sensitiveContent).toBeUndefined();
    });
  });

  it("supports all 11 defined Phase 1 events", () => {
    const expectedEvents: AnalyticsEvent[] = [
      "app_opened",
      "note_created",
      "note_deleted",
      "weekly_summary_opened",
      "monthly_summary_opened",
      "markdown_exported",
      "backup_exported",
      "backup_imported",
      "template_used",
      "command_palette_opened",
      "ai_summary_used"
    ];

    expect([...ALLOWED_ANALYTICS_EVENTS].sort()).toEqual(expectedEvents.sort());
  });

  it("renders privacy settings toggle and updates preference when toggled", async () => {
    document.body.innerHTML = '<div id="app"></div><div id="page-content"></div>';
    const { renderSettings } = await import("../main");
    const content = document.getElementById("page-content")!;

    await setAnalyticsEnabled(false);
    await renderSettings(content);

    const toggle = content.querySelector<HTMLInputElement>("#analytics-enabled-toggle");
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(false);

    const pill = content.querySelector<HTMLElement>("#analytics-status-pill");
    expect(pill?.textContent).toContain("Disabled");

    // Toggle to ON
    toggle!.checked = true;
    toggle!.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await isAnalyticsEnabled()).toBe(true);
    expect(pill?.textContent).toContain("Active");
  });
});
