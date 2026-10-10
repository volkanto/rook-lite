import { describe, expect, it, vi } from "vitest";
import {
  ALLOWED_EVENTS,
  onRequest,
  onRequestPost,
  type AnalyticsEngineDataset,
  type Env,
  type PagesContext
} from "./analytics";

describe("Cloudflare Pages Analytics Endpoint (POST /api/analytics)", () => {
  function createMockEnv(): { env: Env; writeDataPoint: ReturnType<typeof vi.fn> } {
    const writeDataPoint = vi.fn();
    const mockDataset: AnalyticsEngineDataset = {
      writeDataPoint
    };
    return {
      env: { ANALYTICS: mockDataset },
      writeDataPoint
    };
  }

  function createMockContext(
    body: string,
    method = "POST",
    env: Env = {}
  ): PagesContext {
    const request = new Request("https://lite.rooknotes.com/api/analytics", {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? body : undefined
    });

    return {
      request,
      env
    };
  }

  it("returns 204 and writes to Analytics Engine for each valid event", async () => {
    for (const event of ALLOWED_EVENTS) {
      const { env, writeDataPoint } = createMockEnv();
      const context = createMockContext(
        JSON.stringify({ event, version: "1.4.0" }),
        "POST",
        env
      );

      const response = await onRequestPost(context);

      expect(response.status).toBe(204);
      expect(writeDataPoint).toHaveBeenCalledTimes(1);
      expect(writeDataPoint).toHaveBeenCalledWith({
        blobs: [event, "1.4.0"],
        doubles: [1],
        indexes: ["rook-lite"]
      });
    }
  });

  it("returns 400 for unknown event names", async () => {
    const { env, writeDataPoint } = createMockEnv();
    const context = createMockContext(
      JSON.stringify({ event: "unknown_custom_event", version: "1.4.0" }),
      "POST",
      env
    );

    const response = await onRequestPost(context);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unknown event");
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON syntax", async () => {
    const { env, writeDataPoint } = createMockEnv();
    const context = createMockContext("{ not valid json }", "POST", env);

    const response = await onRequestPost(context);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid JSON");
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("returns 400 when payload contains arbitrary metadata or extra keys", async () => {
    const { env, writeDataPoint } = createMockEnv();
    const context = createMockContext(
      JSON.stringify({
        event: "note_created",
        version: "1.4.0",
        metadata: { noteTitle: "Secret Note", userId: "user-123" }
      }),
      "POST",
      env
    );

    const response = await onRequestPost(context);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid payload");
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("returns 400 for missing or empty event or version", async () => {
    const { env, writeDataPoint } = createMockEnv();

    const noEventContext = createMockContext(
      JSON.stringify({ version: "1.4.0" }),
      "POST",
      env
    );
    const res1 = await onRequestPost(noEventContext);
    expect(res1.status).toBe(400);

    const noVersionContext = createMockContext(
      JSON.stringify({ event: "note_created" }),
      "POST",
      env
    );
    const res2 = await onRequestPost(noVersionContext);
    expect(res2.status).toBe(400);

    const emptyEventContext = createMockContext(
      JSON.stringify({ event: "   ", version: "1.4.0" }),
      "POST",
      env
    );
    const res3 = await onRequestPost(emptyEventContext);
    expect(res3.status).toBe(400);

    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("returns 204 gracefully even if ANALYTICS binding is missing", async () => {
    const context = createMockContext(
      JSON.stringify({ event: "app_opened", version: "1.4.0" }),
      "POST",
      {}
    );

    const response = await onRequestPost(context);
    expect(response.status).toBe(204);
  });

  it("rejects non-POST methods with 405 Method Not Allowed in onRequest", async () => {
    const context = createMockContext("", "GET");
    const response = await onRequest(context);
    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data.error).toBe("Method not allowed");
  });
});
