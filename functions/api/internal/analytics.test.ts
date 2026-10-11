import { describe, expect, it } from "vitest";
import {
  calculateDashboardMetrics,
  isAuthorized,
  onRequest,
  onRequestGet,
  parseRange,
  rangeToDays,
  type InternalAnalyticsEnv,
  type PagesContext,
  type RawEventCount,
  type RawTrendItem,
  type RawVersionItem
} from "./analytics";

describe("Internal Analytics Query API (GET /api/internal/analytics)", () => {
  describe("parseRange and rangeToDays", () => {
    it("parses valid ranges correctly", () => {
      expect(parseRange("7d")).toBe("7d");
      expect(parseRange("30d")).toBe("30d");
      expect(parseRange("90d")).toBe("90d");
      expect(parseRange("  30D  ")).toBe("30d");
      expect(parseRange(null)).toBe("30d"); // default
    });

    it("rejects invalid ranges with null", () => {
      expect(parseRange("1d")).toBeNull();
      expect(parseRange("14d")).toBeNull();
      expect(parseRange("year")).toBeNull();
      expect(parseRange("invalid")).toBeNull();
    });

    it("converts ranges to correct day counts", () => {
      expect(rangeToDays("7d")).toBe(7);
      expect(rangeToDays("30d")).toBe(30);
      expect(rangeToDays("90d")).toBe(90);
    });
  });

  describe("isAuthorized", () => {
    it("authorizes when Cloudflare Access email header is present", () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics", {
        headers: { "cf-access-authenticated-user-email": "admin@example.com" }
      });
      const env: InternalAnalyticsEnv = { INTERNAL_ANALYTICS_SECRET: "secret123" };
      expect(isAuthorized(request, env)).toBe(true);
    });

    it("authorizes when Cloudflare Access JWT header is present", () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics", {
        headers: { "cf-access-jwt-assertion": "mock-jwt-token" }
      });
      const env: InternalAnalyticsEnv = { INTERNAL_ANALYTICS_SECRET: "secret123" };
      expect(isAuthorized(request, env)).toBe(true);
    });

    it("authorizes with matching Bearer token in Authorization header", () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics", {
        headers: { Authorization: "Bearer my-secret-token" }
      });
      const env: InternalAnalyticsEnv = { INTERNAL_ANALYTICS_SECRET: "my-secret-token" };
      expect(isAuthorized(request, env)).toBe(true);
    });

    it("authorizes with matching X-Admin-Token header", () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics", {
        headers: { "X-Admin-Token": "my-secret-token" }
      });
      const env: InternalAnalyticsEnv = { INTERNAL_ANALYTICS_SECRET: "my-secret-token" };
      expect(isAuthorized(request, env)).toBe(true);
    });

    it("rejects when secret token is incorrect", () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics", {
        headers: { Authorization: "Bearer wrong-token" }
      });
      const env: InternalAnalyticsEnv = { INTERNAL_ANALYTICS_SECRET: "my-secret-token" };
      expect(isAuthorized(request, env)).toBe(false);
    });

    it("rejects when unauthenticated in production without secret or Access headers", () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics");
      const env: InternalAnalyticsEnv = {};
      expect(isAuthorized(request, env)).toBe(false);
    });

    it("allows in development environment when no secret is configured", () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics");
      const env: InternalAnalyticsEnv = { ENVIRONMENT: "development" };
      expect(isAuthorized(request, env)).toBe(true);
    });
  });

  describe("calculateDashboardMetrics", () => {
    it("aggregates feature totals, version counts, and daily trends correctly", () => {
      const features: RawEventCount[] = [
        { event: "note_created", count: 120 },
        { event: "markdown_export_started", count: 10 },
        { event: "markdown_export_succeeded", count: 9 },
        { event: "markdown_export_failed", count: 1 },
        { event: "ai_summary_started", count: 5 },
        { event: "ai_summary_succeeded", count: 4 },
        { event: "ai_summary_failed", count: 1 }
      ];

      const trends: RawTrendItem[] = [
        { date: "2026-10-09", event: "note_created", count: 50 },
        { date: "2026-10-10", event: "note_created", count: 70 }
      ];

      const versions: RawVersionItem[] = [
        { version: "1.5.0", event: "note_created", count: 100 },
        { version: "1.4.0", event: "note_created", count: 20 }
      ];

      const result = calculateDashboardMetrics("30d", features, trends, versions);

      expect(result.range).toBe("30d");
      expect(result.totals.totalEvents).toBe(150);
      expect(result.features[0]).toEqual({ event: "note_created", count: 120 });
      expect(result.trends).toHaveLength(2);
      expect(result.versions).toHaveLength(2);

      // Markdown export: 9 / (9 + 1) = 90%
      const mdOutcome = result.outcomes.find((o) => o.feature === "Markdown Export");
      expect(mdOutcome).toEqual({
        feature: "Markdown Export",
        started: 10,
        succeeded: 9,
        failed: 1,
        successRate: 90
      });

      // AI summary: 4 / (4 + 1) = 80%
      const aiOutcome = result.outcomes.find((o) => o.feature === "AI Summary");
      expect(aiOutcome).toEqual({
        feature: "AI Summary",
        started: 5,
        succeeded: 4,
        failed: 1,
        successRate: 80
      });

      // Backup restore: 0 operations -> null success rate
      const backupOutcome = result.outcomes.find((o) => o.feature === "Backup Restore");
      expect(backupOutcome).toEqual({
        feature: "Backup Restore",
        started: 0,
        succeeded: 0,
        failed: 0,
        successRate: null
      });
    });

    it("handles zero-operation edge case safely with null success rates", () => {
      const result = calculateDashboardMetrics("7d", [], [], []);

      expect(result.totals.totalEvents).toBe(0);
      expect(result.features).toHaveLength(0);
      expect(result.trends).toHaveLength(0);
      expect(result.versions).toHaveLength(0);
      expect(result.outcomes).toHaveLength(3);
      for (const outcome of result.outcomes) {
        expect(outcome.started).toBe(0);
        expect(outcome.succeeded).toBe(0);
        expect(outcome.failed).toBe(0);
        expect(outcome.successRate).toBeNull();
      }
    });

    it("handles 100% success rate without dividing by zero", () => {
      const features: RawEventCount[] = [
        { event: "markdown_export_started", count: 10 },
        { event: "markdown_export_succeeded", count: 10 },
        { event: "markdown_export_failed", count: 0 }
      ];

      const result = calculateDashboardMetrics("30d", features, [], []);
      const mdOutcome = result.outcomes.find((o) => o.feature === "Markdown Export");
      expect(mdOutcome?.successRate).toBe(100);
    });

    it("handles operations with only started and zero completed as null success rate", () => {
      const features: RawEventCount[] = [{ event: "ai_summary_started", count: 3 }];

      const result = calculateDashboardMetrics("30d", features, [], []);
      const aiOutcome = result.outcomes.find((o) => o.feature === "AI Summary");
      expect(aiOutcome?.started).toBe(3);
      expect(aiOutcome?.succeeded).toBe(0);
      expect(aiOutcome?.failed).toBe(0);
      expect(aiOutcome?.successRate).toBeNull();
    });
  });

  describe("onRequestGet HTTP handler", () => {
    function createMockContext(
      url = "https://lite.rooknotes.com/api/internal/analytics?range=30d",
      headers: Record<string, string> = { "X-Admin-Token": "secret" },
      env: InternalAnalyticsEnv = { INTERNAL_ANALYTICS_SECRET: "secret" }
    ): PagesContext {
      const request = new Request(url, {
        method: "GET",
        headers
      });
      return { request, env };
    }

    it("returns 401 Unauthorized when request lacks valid authentication", async () => {
      const context = createMockContext(
        "https://lite.rooknotes.com/api/internal/analytics?range=30d",
        {},
        { INTERNAL_ANALYTICS_SECRET: "secret" }
      );

      const response = await onRequestGet(context);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized access");
    });

    it("returns 400 Bad Request for invalid range query param", async () => {
      const context = createMockContext(
        "https://lite.rooknotes.com/api/internal/analytics?range=14d"
      );

      const response = await onRequestGet(context);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid range");
    });

    it("returns 200 with structured aggregate response for valid range", async () => {
      const context = createMockContext(
        "https://lite.rooknotes.com/api/internal/analytics?range=7d"
      );

      const response = await onRequestGet(context);
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("private");

      const data = await response.json();
      expect(data.range).toBe("7d");
      expect(data.totals).toHaveProperty("totalEvents");
      expect(Array.isArray(data.features)).toBe(true);
      expect(Array.isArray(data.trends)).toBe(true);
      expect(Array.isArray(data.versions)).toBe(true);
      expect(Array.isArray(data.outcomes)).toBe(true);

      // Verify privacy guarantee: never returns raw records or user identifiers
      expect(JSON.stringify(data)).not.toContain("userId");
      expect(JSON.stringify(data)).not.toContain("sessionId");
      expect(JSON.stringify(data)).not.toContain("ip");
      expect(JSON.stringify(data)).not.toContain("noteId");
    });

    it("rejects non-GET HTTP methods with 405 Method Not Allowed in onRequest", async () => {
      const request = new Request("https://lite.rooknotes.com/api/internal/analytics", {
        method: "POST"
      });
      const response = await onRequest({ request, env: {} });
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });
  });
});
