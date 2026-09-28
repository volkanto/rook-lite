import type { RecentCommand } from "./types";

const RECENT_COMMANDS_KEY = "rook-palette-recent-commands";
const MAX_RECENT_COMMANDS = 20;

export function getRecentCommands(): RecentCommand[] {
  try {
    const raw = localStorage.getItem(RECENT_COMMANDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentCommand =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.lastUsedAt === "number" &&
        typeof item.useCount === "number"
    );
  } catch {
    return [];
  }
}

export function recordCommandUse(id: string): void {
  try {
    const recent = getRecentCommands();
    const existingIndex = recent.findIndex((cmd) => cmd.id === id);
    const now = Date.now();

    if (existingIndex >= 0) {
      const existing = recent[existingIndex];
      recent.splice(existingIndex, 1);
      recent.unshift({
        id,
        lastUsedAt: now,
        useCount: (existing.useCount || 0) + 1
      });
    } else {
      recent.unshift({
        id,
        lastUsedAt: now,
        useCount: 1
      });
    }

    const trimmed = recent.slice(0, MAX_RECENT_COMMANDS);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore localStorage errors (e.g., privacy mode)
  }
}

export function clearRecentCommands(): void {
  try {
    localStorage.removeItem(RECENT_COMMANDS_KEY);
  } catch {
    // Ignore
  }
}
