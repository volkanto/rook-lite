import { escapeHtml } from "../markdown";

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

export const EVENT_DISPLAY_NAMES: Record<string, string> = {
  app_opened: "App Opened",
  note_created: "Note Created",
  note_deleted: "Note Deleted",
  weekly_summary_opened: "Weekly Summary Opened",
  monthly_summary_opened: "Monthly Summary Opened",
  markdown_exported: "Markdown Exported",
  backup_exported: "Backup Exported",
  backup_imported: "Backup Restored",
  template_used: "Template Used",
  command_palette_opened: "Command Palette Opened",
  ai_summary_used: "AI Summary Used",
  markdown_export_started: "Markdown Export (Started)",
  markdown_export_succeeded: "Markdown Export (Succeeded)",
  markdown_export_failed: "Markdown Export (Failed)",
  backup_import_started: "Backup Restore (Started)",
  backup_import_succeeded: "Backup Restore (Succeeded)",
  backup_import_failed: "Backup Restore (Failed)",
  ai_summary_started: "AI Summary (Started)",
  ai_summary_succeeded: "AI Summary (Succeeded)",
  ai_summary_failed: "AI Summary (Failed)"
};

export const DEFAULT_TREND_EVENTS = [
  "note_created",
  "weekly_summary_opened",
  "markdown_exported",
  "ai_summary_used"
];

const CHART_COLORS: Record<string, string> = {
  note_created: "#3b82f6",
  weekly_summary_opened: "#10b981",
  markdown_exported: "#f59e0b",
  ai_summary_used: "#8b5cf6",
  template_used: "#ec4899",
  app_opened: "#6366f1",
  command_palette_opened: "#06b6d4"
};

let currentRange: DashboardRange = "30d";
let selectedTrendEvents: Set<string> = new Set(DEFAULT_TREND_EVENTS);
let selectedVersionFeature = "all";

export async function fetchAnalyticsData(
  range: DashboardRange,
  token?: string
): Promise<{ data: AnalyticsDashboardResponse | null; status: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["X-Admin-Token"] = token;
    }

    const res = await fetch(`/api/internal/analytics?range=${range}`, {
      method: "GET",
      headers
    });

    if (res.status === 401 || res.status === 403) {
      return { data: null, status: res.status, error: "Unauthorized access" };
    }

    if (!res.ok) {
      return { data: null, status: res.status, error: `Server error (${res.status})` };
    }

    const data = (await res.json()) as AnalyticsDashboardResponse;
    return { data, status: 200 };
  } catch {
    return { data: null, status: 0, error: "Network or connection error" };
  }
}

export function renderTrendSvg(
  trends: Array<{ date: string; event: string; count: number }>,
  activeEvents: Set<string>
): string {
  const filtered = trends.filter((t) => activeEvents.has(t.event));
  if (filtered.length === 0) {
    return `<div class="dashboard-empty-chart"><p class="muted">No trend data recorded for selected events in this range.</p></div>`;
  }

  // Collect sorted unique dates
  const dates = Array.from(new Set(filtered.map((t) => t.date))).sort();
  if (dates.length <= 1) {
    return `<div class="dashboard-empty-chart"><p class="muted">Gathering daily data points... (Needs 2+ days for visual trend lines)</p></div>`;
  }

  // Find max count for Y scale
  let maxCount = 1;
  for (const item of filtered) {
    if (item.count > maxCount) maxCount = item.count;
  }
  // Add 10% headroom
  maxCount = Math.ceil(maxCount * 1.1);

  const width = 640;
  const height = 200;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getX = (idx: number) => padLeft + (idx / (dates.length - 1)) * chartW;
  const getY = (val: number) => padTop + chartH - (val / maxCount) * chartH;

  // Render gridlines
  const gridLines = [0, 0.5, 1]
    .map((ratio) => {
      const y = padTop + chartH * (1 - ratio);
      const val = Math.round(maxCount * ratio);
      return `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--color-border-subtle)" stroke-dasharray="3 3" />
        <text x="${padLeft - 8}" y="${y + 4}" fill="var(--color-text-muted)" font-size="10" text-anchor="end">${val}</text>
      `;
    })
    .join("");

  // Group items by event
  const eventLines: string[] = [];
  for (const eventName of activeEvents) {
    const points: string[] = [];
    const eventColor = CHART_COLORS[eventName] || "#6b7280";

    dates.forEach((d, idx) => {
      const match = filtered.find((item) => item.date === d && item.event === eventName);
      const count = match ? match.count : 0;
      const x = getX(idx);
      const y = getY(count);
      points.push(`${x},${y}`);
    });

    const polyline = `<polyline points="${points.join(" ")}" fill="none" stroke="${eventColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;

    // Render circles with tooltips
    const dots = dates
      .map((d, idx) => {
        const match = filtered.find((item) => item.date === d && item.event === eventName);
        const count = match ? match.count : 0;
        const x = getX(idx);
        const y = getY(count);
        const displayName = EVENT_DISPLAY_NAMES[eventName] || eventName;
        return `
          <circle cx="${x}" cy="${y}" r="3.5" fill="${eventColor}">
            <title>${escapeHtml(displayName)}: ${count} (${d})</title>
          </circle>
        `;
      })
      .join("");

    eventLines.push(`${polyline}${dots}`);
  }

  // Render X axis dates (first, middle, last)
  const xAxisLabels = `
    <text x="${getX(0)}" y="${height - 10}" fill="var(--color-text-muted)" font-size="10" text-anchor="start">${dates[0]}</text>
    <text x="${getX(Math.floor(dates.length / 2))}" y="${height - 10}" fill="var(--color-text-muted)" font-size="10" text-anchor="middle">${dates[Math.floor(dates.length / 2)]}</text>
    <text x="${getX(dates.length - 1)}" y="${height - 10}" fill="var(--color-text-muted)" font-size="10" text-anchor="end">${dates[dates.length - 1]}</text>
  `;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="dashboard-chart-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Feature usage daily trend chart">
      ${gridLines}
      ${eventLines.join("")}
      ${xAxisLabels}
    </svg>
  `;
}

export async function renderInternalAnalytics(content: HTMLElement): Promise<void> {
  document.title = "Analytics Dashboard · Rook Lite";

  const storedToken = sessionStorage.getItem("rook_admin_analytics_token") || "";

  // Loading state
  content.innerHTML = `
    <div class="internal-analytics-page">
      <header class="page-head">
        <div>
          <div class="title-with-badge">
            <h1>Internal Analytics</h1>
            <span class="ai-privacy-pill">Private</span>
          </div>
          <p class="lede">Anonymous product usage counters and outcome metrics.</p>
        </div>
      </header>
      <div class="dashboard-loading-spinner">
        <p class="muted">Loading analytics data...</p>
      </div>
    </div>
  `;

  const { data, status, error } = await fetchAnalyticsData(currentRange, storedToken);

  if (status === 401 || status === 403) {
    renderUnauthorizedState(content);
    return;
  }

  if (error || !data) {
    renderErrorState(content, error || "Unknown error");
    return;
  }

  renderDashboardView(content, data);
}

function renderUnauthorizedState(content: HTMLElement): void {
  content.innerHTML = `
    <div class="internal-analytics-page">
      <header class="page-head">
        <div>
          <div class="title-with-badge">
            <h1>Internal Analytics</h1>
            <span class="ai-privacy-pill" style="color: var(--color-danger, #ef4444); border-color: currentColor;">Protected</span>
          </div>
          <p class="lede">This dashboard is restricted to the project owner.</p>
        </div>
      </header>

      <section class="settings-card auth-card">
        <h2 class="settings-section-title">Admin Authentication Required</h2>
        <p class="muted">
          Access to Cloudflare Analytics Engine metrics is protected. If using Cloudflare Access, ensure you are authenticated through your organization's Zero Trust access portal.
        </p>

        <form id="admin-auth-form" class="auth-token-form">
          <label for="admin-token-input" class="settings-row-label">Admin Secret Token</label>
          <input type="password" id="admin-token-input" placeholder="Enter INTERNAL_ANALYTICS_SECRET" class="search-input" autocomplete="current-password" required>
          <div class="auth-form-actions">
            <button type="submit" class="save-btn-rect">Authenticate & Open</button>
          </div>
          <p class="hint">Token is stored in temporary session memory only and cleared when the tab closes.</p>
        </form>
      </section>
    </div>
  `;

  const form = content.querySelector<HTMLFormElement>("#admin-auth-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = content.querySelector<HTMLInputElement>("#admin-token-input");
    const val = input?.value.trim();
    if (val) {
      sessionStorage.setItem("rook_admin_analytics_token", val);
      await renderInternalAnalytics(content);
    }
  });
}

function renderErrorState(content: HTMLElement, errorMsg: string): void {
  content.innerHTML = `
    <div class="internal-analytics-page">
      <header class="page-head">
        <div>
          <h1>Internal Analytics</h1>
          <p class="lede">Anonymous product usage counters and outcome metrics.</p>
        </div>
      </header>
      <div class="notice error">
        <p><strong>Failed to load analytics:</strong> ${escapeHtml(errorMsg)}</p>
        <button type="button" id="retry-analytics-btn" class="save-btn-rect" style="margin-top: 0.75rem;">Retry</button>
      </div>
    </div>
  `;

  content.querySelector("#retry-analytics-btn")?.addEventListener("click", () => {
    void renderInternalAnalytics(content);
  });
}

function renderDashboardView(content: HTMLElement, data: AnalyticsDashboardResponse): void {
  // Top KPI calculations
  const totalEventsFormatted = data.totals.totalEvents.toLocaleString();
  const topFeature = data.features[0];
  const topFeatureName = topFeature
    ? EVENT_DISPLAY_NAMES[topFeature.event] || topFeature.event
    : "None";
  const topFeatureCount = topFeature ? `(${topFeature.count.toLocaleString()})` : "";

  const mdOutcome = data.outcomes.find((o) => o.feature === "Markdown Export");
  const aiOutcome = data.outcomes.find((o) => o.feature === "AI Summary");

  const mdRateText =
    mdOutcome && mdOutcome.successRate !== null ? `${mdOutcome.successRate}%` : "—";
  const aiRateText =
    aiOutcome && aiOutcome.successRate !== null ? `${aiOutcome.successRate}%` : "—";

  // Available trend events for toggling
  const trendEventsAvailable = Array.from(new Set(data.trends.map((t) => t.event)));
  if (trendEventsAvailable.length === 0) {
    DEFAULT_TREND_EVENTS.forEach((e) => trendEventsAvailable.push(e));
  }

  // Version aggregation
  const versionTotalsMap = new Map<string, number>();
  for (const v of data.versions) {
    if (selectedVersionFeature === "all" || v.event === selectedVersionFeature) {
      versionTotalsMap.set(v.version, (versionTotalsMap.get(v.version) ?? 0) + v.count);
    }
  }
  const versionList = Array.from(versionTotalsMap.entries())
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => b.count - a.count);

  const totalVersionEvents = versionList.reduce((acc, curr) => acc + curr.count, 0);

  content.innerHTML = `
    <div class="internal-analytics-page">
      <header class="page-head dashboard-header">
        <div>
          <div class="title-with-badge">
            <h1>Internal Analytics</h1>
            <span class="ai-privacy-pill">Private</span>
          </div>
          <p class="lede">Privacy-preserving feature counters and outcome health.</p>
        </div>

        <!-- Range Selector -->
        <div class="settings-segmented-control range-selector" role="group" aria-label="Time range">
          <button type="button" class="segmented-option ${currentRange === "7d" ? "is-selected" : ""}" data-range="7d">7 Days</button>
          <button type="button" class="segmented-option ${currentRange === "30d" ? "is-selected" : ""}" data-range="30d">30 Days</button>
          <button type="button" class="segmented-option ${currentRange === "90d" ? "is-selected" : ""}" data-range="90d">90 Days</button>
        </div>
      </header>

      <!-- KPI Summary Cards -->
      <div class="dashboard-kpi-grid">
        <div class="dashboard-kpi-card">
          <span class="kpi-label">Feature Events</span>
          <span class="kpi-value">${totalEventsFormatted}</span>
          <span class="kpi-subtext">Total recorded in last ${data.range}</span>
        </div>
        <div class="dashboard-kpi-card">
          <span class="kpi-label">Most-Used Feature</span>
          <span class="kpi-value" style="font-size: 1.25rem;">${escapeHtml(topFeatureName)}</span>
          <span class="kpi-subtext">${topFeatureCount}</span>
        </div>
        <div class="dashboard-kpi-card">
          <span class="kpi-label">Markdown Export Success</span>
          <span class="kpi-value ${mdOutcome?.successRate !== null && mdOutcome!.successRate! >= 95 ? "kpi-good" : ""}">${mdRateText}</span>
          <span class="kpi-subtext">${mdOutcome ? `${mdOutcome.succeeded} / ${mdOutcome.started} started` : "No attempts"}</span>
        </div>
        <div class="dashboard-kpi-card">
          <span class="kpi-label">AI Summary Success</span>
          <span class="kpi-value ${aiOutcome?.successRate !== null && aiOutcome!.successRate! >= 90 ? "kpi-good" : ""}">${aiRateText}</span>
          <span class="kpi-subtext">${aiOutcome ? `${aiOutcome.succeeded} / ${aiOutcome.started} started` : "No attempts"}</span>
        </div>
      </div>

      <!-- Trend Chart Section -->
      <section class="settings-card dashboard-section">
        <div class="dashboard-section-header">
          <div>
            <h2 class="settings-section-title">Daily Feature Trends</h2>
            <p class="muted">Track feature trajectory and release impact over time.</p>
          </div>
          <!-- Trend Event Filter Pills -->
          <div class="trend-filter-chips">
            ${trendEventsAvailable
              .slice(0, 6)
              .map((evt) => {
                const active = selectedTrendEvents.has(evt);
                const color = CHART_COLORS[evt] || "#6b7280";
                return `
                  <button type="button" class="trend-chip ${active ? "is-active" : ""}" data-trend-event="${evt}">
                    <span class="trend-chip-dot" style="background-color: ${color};"></span>
                    <span>${escapeHtml(EVENT_DISPLAY_NAMES[evt] || evt)}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>

        <div class="dashboard-chart-wrapper">
          ${renderTrendSvg(data.trends, selectedTrendEvents)}
        </div>
      </section>

      <div class="dashboard-split-grid">
        <!-- Feature Usage Ranking -->
        <section class="settings-card dashboard-section">
          <h2 class="settings-section-title">Feature Usage Ranking</h2>
          <p class="muted">Ordered by total anonymous actions (Last ${data.range}).</p>

          <div class="dashboard-ranking-list">
            ${
              data.features.length === 0
                ? '<p class="muted">No feature events recorded yet.</p>'
                : data.features
                    .map((item, idx) => {
                      const maxF = data.features[0].count || 1;
                      const pct = Math.round((item.count / maxF) * 100);
                      const displayName = EVENT_DISPLAY_NAMES[item.event] || item.event;
                      return `
                      <div class="dashboard-ranking-item">
                        <div class="ranking-item-meta">
                          <span class="ranking-rank">${idx + 1}</span>
                          <span class="ranking-name">${escapeHtml(displayName)}</span>
                          <span class="ranking-code">${escapeHtml(item.event)}</span>
                          <span class="ranking-count">${item.count.toLocaleString()}</span>
                        </div>
                        <div class="ranking-bar-bg">
                          <div class="ranking-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                      </div>
                    `;
                    })
                    .join("")
            }
          </div>
        </section>

        <!-- Lifecycle Outcome Health -->
        <section class="settings-card dashboard-section">
          <h2 class="settings-section-title">Operation Outcomes & Health</h2>
          <p class="muted">Success and failure rates for key product operations.</p>

          <div class="outcome-cards-list">
            ${data.outcomes
              .map((o) => {
                const rate = o.successRate !== null ? `${o.successRate}%` : "No data";
                const isHealthy = o.successRate !== null && o.successRate >= 95;
                const isWarning = o.successRate !== null && o.successRate < 95 && o.successRate >= 80;
                const isCrit = o.successRate !== null && o.successRate < 80;
                const statusClass = isHealthy ? "badge-healthy" : isWarning ? "badge-warning" : isCrit ? "badge-crit" : "badge-neutral";

                return `
                  <div class="outcome-card">
                    <div class="outcome-card-head">
                      <strong>${escapeHtml(o.feature)}</strong>
                      <span class="outcome-badge ${statusClass}">${rate}</span>
                    </div>
                    <div class="outcome-stats-grid">
                      <div><span class="outcome-stat-label">Started</span><strong>${o.started}</strong></div>
                      <div><span class="outcome-stat-label">Succeeded</span><strong style="color: var(--color-success, #10b981);">${o.succeeded}</strong></div>
                      <div><span class="outcome-stat-label">Failed</span><strong style="color: ${o.failed > 0 ? "var(--color-danger, #ef4444)" : "inherit"};">${o.failed}</strong></div>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>

          <!-- App Version Breakdown -->
          <div style="margin-top: 2rem;">
            <div class="version-head-row">
              <h2 class="settings-section-title" style="margin: 0;">App Version Adoption</h2>
              <select id="version-feature-filter" class="version-select">
                <option value="all" ${selectedVersionFeature === "all" ? "selected" : ""}>All Features</option>
                ${data.features.slice(0, 8).map((f) => `<option value="${f.event}" ${selectedVersionFeature === f.event ? "selected" : ""}>${escapeHtml(EVENT_DISPLAY_NAMES[f.event] || f.event)}</option>`).join("")}
              </select>
            </div>
            <p class="muted" style="margin-top: 0.25rem;">Events emitted per application version.</p>

            <table class="version-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Events</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                ${
                  versionList.length === 0
                    ? '<tr><td colspan="3" class="muted">No version data recorded.</td></tr>'
                    : versionList
                        .map((v) => {
                          const pct = totalVersionEvents > 0 ? ((v.count / totalVersionEvents) * 100).toFixed(1) : "0";
                          return `
                            <tr>
                              <td><code>${escapeHtml(v.version)}</code></td>
                              <td>${v.count.toLocaleString()}</td>
                              <td>${pct}%</td>
                            </tr>
                          `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Privacy & Architecture Callout -->
      <footer class="dashboard-privacy-note">
        <p class="muted">
          🔒 <strong>Privacy Boundary:</strong> All metrics shown are aggregate counts computed in memory from Cloudflare Analytics Engine. Rook Lite records no IP addresses, user IDs, device fingerprints, note contents, tags, searches, or AI prompts.
        </p>
      </footer>
    </div>
  `;

  // Bind range selector buttons
  content.querySelectorAll<HTMLButtonElement>("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = btn.dataset.range as DashboardRange;
      if (r && r !== currentRange) {
        currentRange = r;
        void renderInternalAnalytics(content);
      }
    });
  });

  // Bind trend chip toggles
  content.querySelectorAll<HTMLButtonElement>("[data-trend-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const evt = btn.dataset.trendEvent;
      if (!evt) return;
      if (selectedTrendEvents.has(evt)) {
        if (selectedTrendEvents.size > 1) {
          selectedTrendEvents.delete(evt);
        }
      } else {
        selectedTrendEvents.add(evt);
      }
      renderDashboardView(content, data);
    });
  });

  // Bind version feature filter
  const versionSelect = content.querySelector<HTMLSelectElement>("#version-feature-filter");
  versionSelect?.addEventListener("change", () => {
    selectedVersionFeature = versionSelect.value;
    renderDashboardView(content, data);
  });
}
