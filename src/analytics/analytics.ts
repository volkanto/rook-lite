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
  "ai_summary_used"
] as const;

export type AnalyticsEvent = (typeof ALLOWED_ANALYTICS_EVENTS)[number];

export const ANALYTICS_SETTING_KEY = "analyticsEnabled";

export async function isAnalyticsEnabled(): Promise<boolean> {
  try {
    const value = await settingsRepository.get<boolean>(ANALYTICS_SETTING_KEY);
    return value === true;
  } catch {
    return false;
  }
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  await settingsRepository.set(ANALYTICS_SETTING_KEY, Boolean(enabled));
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
