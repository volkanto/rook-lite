/**
 * Cloudflare Pages Function: POST /api/analytics
 * Writes anonymous feature usage data points to Cloudflare Analytics Engine.
 */

export const ALLOWED_EVENTS = [
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
] as const;

export type AnalyticsEvent = (typeof ALLOWED_EVENTS)[number];

export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: (string | null | undefined)[];
    doubles?: (number | null | undefined)[];
    indexes?: (string | null | undefined)[];
  }): void;
}

export interface Env {
  ANALYTICS?: AnalyticsEngineDataset;
}

export interface PagesContext {
  request: Request;
  env: Env;
  params?: Record<string, string | string[]>;
  data?: Record<string, unknown>;
  next?: () => Promise<Response>;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  const allowedKeys = new Set(["event", "version"]);
  const hasDisallowedKeys = keys.some((key) => !allowedKeys.has(key));

  if (
    hasDisallowedKeys ||
    typeof record.event !== "string" ||
    typeof record.version !== "string"
  ) {
    return new Response(
      JSON.stringify({
        error: "Invalid payload: must contain only 'event' and 'version'"
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const event = record.event.trim();
  const version = record.version.trim();

  if (!event || !version) {
    return new Response(
      JSON.stringify({ error: "Event and version must be non-empty strings" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  if (!ALLOWED_EVENTS.includes(event as AnalyticsEvent)) {
    return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (context.env?.ANALYTICS) {
    /**
     * Cloudflare Analytics Engine Schema:
     * - blob1: event name (string)
     * - blob2: application version (string)
     * - double1: count, always 1
     * - index1: "rook-lite"
     */
    context.env.ANALYTICS.writeDataPoint({
      blobs: [event, version],
      doubles: [1],
      indexes: ["rook-lite"]
    });
  }

  return new Response(null, { status: 204 });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" }
    });
  }
  return onRequestPost(context);
}
