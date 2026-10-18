import { settingsRepository } from "../data";
import { APP_VERSION } from "../version";

export const ALLOWED_ANALYTICS_EVENTS = [
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
  "ai_summary_used",
  // Phase 2 outcome analytics
  "markdown_export_started",
  "markdown_export_succeeded",
  "markdown_export_failed",
  "backup_import_started",
  "backup_import_succeeded",
  "backup_import_failed",
  "ai_summary_started",
  "ai_summary_succeeded",
  "ai_summary_failed"
] as const;

export type AnalyticsEvent = (typeof ALLOWED_ANALYTICS_EVENTS)[number];

export const ANALYTICS_SETTING_KEY = "analyticsEnabled";
export const ANALYTICS_NOTICE_DISMISSED_KEY = "rook_analytics_notice_dismissed";

export async function isAnalyticsEnabled(): Promise<boolean> {
  try {
    const value = await settingsRepository.get<boolean>(ANALYTICS_SETTING_KEY);
    // Analytics is enabled by default unless explicitly disabled by user (value === false)
    return value !== false;
  } catch {
    return true;
  }
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  await settingsRepository.set(ANALYTICS_SETTING_KEY, Boolean(enabled));
}

export function isAnalyticsNoticeDismissed(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_NOTICE_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissAnalyticsNotice(): void {
  try {
    localStorage.setItem(ANALYTICS_NOTICE_DISMISSED_KEY, "true");
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

export function resetAnalyticsNoticeDismissed(): void {
  try {
    localStorage.removeItem(ANALYTICS_NOTICE_DISMISSED_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Tracks an anonymous product usage event.
 * If analytics are disabled or fail, this function returns silently without throwing.
 */
export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    const enabled = await isAnalyticsEnabled();
    if (!enabled) {
      return;
    }

    await fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event,
        version: APP_VERSION
      })
    });
  } catch {
    // Silently ignore network or analytics failures. Never block or break user-facing features.
  }
}
