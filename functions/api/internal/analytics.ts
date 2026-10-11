/**
 * Cloudflare Pages Function: GET /api/internal/analytics
 * Private analytics query API for project owner dashboard.
 * Queries Cloudflare Analytics Engine and returns aggregate statistics.
 */

export type DashboardRange = "7d" | "30d" | "90d";

export interface AnalyticsDashboardResponse {
  range: DashboardRange;
  totals: {
    totalEvents: number;
  };
  features: Array<{
    event: string;
    count: number;
  }>;
  trends: Array<{
    date: string;
    event: string;
    count: number;
  }>;
  versions: Array<{
    version: string;
    event: string;
    count: number;
  }>;
  outcomes: Array<{
    feature: string;
    started: number;
    succeeded: number;
    failed: number;
    successRate: number | null;
  }>;
}

export interface InternalAnalyticsEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  INTERNAL_ANALYTICS_SECRET?: string;
  ENVIRONMENT?: string;
}

export interface PagesContext {
  request: Request;
  env: InternalAnalyticsEnv;
  params?: Record<string, string | string[]>;
  data?: Record<string, unknown>;
  next?: () => Promise<Response>;
}

export const VALID_RANGES: readonly DashboardRange[] = ["7d", "30d", "90d"] as const;

export function parseRange(rangeParam: string | null): DashboardRange | null {
  if (!rangeParam) return "30d";
  const normalized = rangeParam.trim().toLowerCase();
  if (normalized === "7d" || normalized === "30d" || normalized === "90d") {
    return normalized as DashboardRange;
  }
  return null;
}

export function rangeToDays(range: DashboardRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
  }
}

/**
 * Validates request authorization.
 * Supports Cloudflare Access headers, or a shared admin secret (Bearer / X-Admin-Token).
 */
export function isAuthorized(request: Request, env: InternalAnalyticsEnv): boolean {
  // 1. Cloudflare Access identity header
  const cfAccessEmail = request.headers.get("cf-access-authenticated-user-email");
  const cfAccessJwt = request.headers.get("cf-access-jwt-assertion");
  if (cfAccessEmail || cfAccessJwt) {
    return true;
  }

  // 2. Secret token header or Bearer authorization
  const authHeader = request.headers.get("Authorization") || "";
  const tokenHeader = request.headers.get("X-Admin-Token") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const providedSecret = bearerToken || tokenHeader;

  if (env.INTERNAL_ANALYTICS_SECRET) {
    return Boolean(providedSecret && providedSecret === env.INTERNAL_ANALYTICS_SECRET);
  }

  // 3. In non-production development environments with no secret set, allow local inspection
  if (env.ENVIRONMENT === "development") {
    return true;
  }

  return false;
}

export interface RawEventCount {
  event: string;
  count: number;
}

export interface RawTrendItem {
  date: string;
  event: string;
  count: number;
}

export interface RawVersionItem {
  version: string;
  event: string;
  count: number;
}

/**
 * Calculates aggregated dashboard statistics from raw counts.
 * Enforces privacy boundary: only aggregate numbers, zero raw events or user traces.
 */
export function calculateDashboardMetrics(
  range: DashboardRange,
  features: RawEventCount[],
  trends: RawTrendItem[],
  versions: RawVersionItem[]
): AnalyticsDashboardResponse {
  // Sort features by count descending
  const sortedFeatures = [...features].sort((a, b) => b.count - a.count);
  const totalEvents = sortedFeatures.reduce((acc, curr) => acc + curr.count, 0);

  // Group outcome features
  const featureCountsMap = new Map<string, number>();
  for (const item of features) {
    featureCountsMap.set(item.event, item.count);
  }

  const outcomeDefinitions = [
    { key: "markdown_export", label: "Markdown Export" },
    { key: "backup_import", label: "Backup Restore" },
    { key: "ai_summary", label: "AI Summary" }
  ];

  const outcomes = outcomeDefinitions.map((def) => {
    const started = featureCountsMap.get(`${def.key}_started`) ?? 0;
    const succeeded = featureCountsMap.get(`${def.key}_succeeded`) ?? 0;
    const failed = featureCountsMap.get(`${def.key}_failed`) ?? 0;

    const totalCompleted = succeeded + failed;
    const successRate =
      totalCompleted > 0 ? Math.round((succeeded / totalCompleted) * 1000) / 10 : null;

    return {
      feature: def.label,
      started,
      succeeded,
      failed,
      successRate
    };
  });

  // Sort trends by date ascending
  const sortedTrends = [...trends].sort((a, b) => a.date.localeCompare(b.date));

  // Sort versions by count descending
  const sortedVersions = [...versions].sort((a, b) => b.count - a.count);

  return {
    range,
    totals: { totalEvents },
    features: sortedFeatures,
    trends: sortedTrends,
    versions: sortedVersions,
    outcomes
  };
}

/**
 * Executes SQL query against Cloudflare Analytics Engine SQL API.
 */
export async function queryAnalyticsEngine<T>(
  accountId: string,
  apiToken: string,
  sql: string
): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "text/plain"
    },
    body: sql
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Analytics Engine query failed: HTTP ${response.status} ${errText}`);
  }

  const result = (await response.json()) as { data?: T[] };
  return result.data || [];
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  // 1. Authorization check
  if (!isAuthorized(context.request, context.env)) {
    return new Response(JSON.stringify({ error: "Unauthorized access" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 2. Parse range
  const url = new URL(context.request.url);
  const rangeParam = url.searchParams.get("range");
  const range = parseRange(rangeParam);

  if (!range) {
    return new Response(
      JSON.stringify({ error: "Invalid range. Supported ranges: 7d, 30d, 90d" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const days = rangeToDays(range);

  // 3. Query Cloudflare Analytics Engine if credentials are provided
  const accountId = context.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = context.env.CLOUDFLARE_API_TOKEN;

  let featureRows: RawEventCount[] = [];
  let trendRows: RawTrendItem[] = [];
  let versionRows: RawVersionItem[] = [];

  if (accountId && apiToken) {
    try {
      // Query A: Feature totals
      const sqlFeatures = `
        SELECT
          blob1 AS event,
          toInt64(SUM(_sample_interval)) AS count
        FROM rook_lite_events
        WHERE timestamp >= NOW() - INTERVAL '${days}' DAY
        GROUP BY blob1
        ORDER BY count DESC
      `.trim();

      // Query B: Daily trends
      const sqlTrends = `
        SELECT
          substring(toString(toStartOfDay(timestamp)), 1, 10) AS date,
          blob1 AS event,
          toInt64(SUM(_sample_interval)) AS count
        FROM rook_lite_events
        WHERE timestamp >= NOW() - INTERVAL '${days}' DAY
        GROUP BY date, event
        ORDER BY date ASC, count DESC
      `.trim();

      // Query C: Version breakdown
      const sqlVersions = `
        SELECT
          blob2 AS version,
          blob1 AS event,
          toInt64(SUM(_sample_interval)) AS count
        FROM rook_lite_events
        WHERE timestamp >= NOW() - INTERVAL '${days}' DAY
        GROUP BY version, event
        ORDER BY count DESC
      `.trim();

      const [resFeatures, resTrends, resVersions] = await Promise.all([
        queryAnalyticsEngine<{ event: string; count: number }>(accountId, apiToken, sqlFeatures),
        queryAnalyticsEngine<{ date: string; event: string; count: number }>(accountId, apiToken, sqlTrends),
        queryAnalyticsEngine<{ version: string; event: string; count: number }>(accountId, apiToken, sqlVersions)
      ]);

      featureRows = resFeatures.map((r) => ({ event: String(r.event), count: Number(r.count) }));
      trendRows = resTrends.map((r) => ({ date: String(r.date), event: String(r.event), count: Number(r.count) }));
      versionRows = resVersions.map((r) => ({ version: String(r.version), event: String(r.event), count: Number(r.count) }));
    } catch {
      // Return 500 error without leaking internal credentials or query bodies
      return new Response(JSON.stringify({ error: "Failed to retrieve analytics data" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  const metrics = calculateDashboardMetrics(range, featureRows, trendRows, versionRows);

  return new Response(JSON.stringify(metrics), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache, no-store"
    }
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET" }
    });
  }
  return onRequestGet(context);
}
