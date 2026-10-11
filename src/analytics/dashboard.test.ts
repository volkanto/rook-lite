// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAnalyticsData,
  renderInternalAnalytics,
  renderTrendSvg,
  type AnalyticsDashboardResponse
} from "./dashboard";

describe("Internal Analytics Dashboard", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="page-content"></div>';
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const mockResponse: AnalyticsDashboardResponse = {
    range: "30d",
    totals: { totalEvents: 1250 },
    features: [
      { event: "note_created", count: 800 },
      { event: "weekly_summary_opened", count: 300 },
      { event: "markdown_export_succeeded", count: 100 },
      { event: "markdown_export_failed", count: 50 }
    ],
    trends: [
      { date: "2026-10-01", event: "note_created", count: 40 },
      { date: "2026-10-02", event: "note_created", count: 60 },
      { date: "2026-10-01", event: "weekly_summary_opened", count: 10 },
      { date: "2026-10-02", event: "weekly_summary_opened", count: 15 }
    ],
    versions: [
      { version: "1.5.0", event: "note_created", count: 700 },
      { version: "1.4.0", event: "note_created", count: 100 }
    ],
    outcomes: [
      {
        feature: "Markdown Export",
        started: 150,
        succeeded: 100,
        failed: 50,
        successRate: 66.7
      },
      {
        feature: "Backup Restore",
        started: 0,
        succeeded: 0,
        failed: 0,
        successRate: null
      },
      {
        feature: "AI Summary",
        started: 10,
        succeeded: 9,
        failed: 1,
        successRate: 90
      }
    ]
  };

  describe("fetchAnalyticsData", () => {
    it("makes GET request to /api/internal/analytics with range", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await fetchAnalyticsData("7d", "secret-token");

      expect(fetchSpy).toHaveBeenCalledWith("/api/internal/analytics?range=7d", {
        method: "GET",
        headers: {
          Authorization: "Bearer secret-token",
          "X-Admin-Token": "secret-token"
        }
      });
      expect(result.status).toBe(200);
      expect(result.data).toEqual(mockResponse);
    });

    it("handles 401 Unauthorized status gracefully", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await fetchAnalyticsData("30d");

      expect(result.status).toBe(401);
      expect(result.error).toBe("Unauthorized access");
      expect(result.data).toBeNull();
    });

    it("handles network failure without throwing", async () => {
      const fetchSpy = vi.fn().mockRejectedValue(new TypeError("Network error"));
      vi.stubGlobal("fetch", fetchSpy);

      const result = await fetchAnalyticsData("30d");

      expect(result.status).toBe(0);
      expect(result.error).toContain("Network");
      expect(result.data).toBeNull();
    });
  });

  describe("renderTrendSvg", () => {
    it("renders SVG with polylines for active trend events", () => {
      const svgHtml = renderTrendSvg(mockResponse.trends, new Set(["note_created"]));

      expect(svgHtml).toContain("<svg");
      expect(svgHtml).toContain("<polyline");
      expect(svgHtml).toContain("2026-10-01");
      expect(svgHtml).toContain("2026-10-02");
    });

    it("renders empty notice when active events have no trend data", () => {
      const svgHtml = renderTrendSvg([], new Set(["note_created"]));

      expect(svgHtml).toContain("No trend data recorded");
    });
  });

  describe("renderInternalAnalytics", () => {
    it("renders dashboard metrics view when fetch succeeds", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });
      vi.stubGlobal("fetch", fetchSpy);

      const content = document.getElementById("page-content")!;
      await renderInternalAnalytics(content);

      // Top KPI cards
      expect(content.textContent).toContain("Internal Analytics");
      expect(content.textContent).toContain("1,250"); // Total events
      expect(content.textContent).toContain("Note Created"); // Top feature
      expect(content.textContent).toContain("66.7%"); // Markdown export success

      // Feature ranking
      expect(content.textContent).toContain("Feature Usage Ranking");
      expect(content.textContent).toContain("800");

      // Outcome health
      expect(content.textContent).toContain("Operation Outcomes & Health");
      expect(content.textContent).toContain("Backup Restore");
      expect(content.textContent).toContain("No data"); // 0 operations

      // Version table
      expect(content.textContent).toContain("1.5.0");
      expect(content.textContent).toContain("App Version Adoption");
    });

    it("renders authentication card when 401 Unauthorized is returned", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });
      vi.stubGlobal("fetch", fetchSpy);

      const content = document.getElementById("page-content")!;
      await renderInternalAnalytics(content);

      expect(content.textContent).toContain("Admin Authentication Required");
      expect(content.querySelector("#admin-token-input")).not.toBeNull();
    });

    it("renders retryable error banner on server failure", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });
      vi.stubGlobal("fetch", fetchSpy);

      const content = document.getElementById("page-content")!;
      await renderInternalAnalytics(content);

      expect(content.textContent).toContain("Failed to load analytics");
      expect(content.querySelector("#retry-analytics-btn")).not.toBeNull();
    });
  });
});
