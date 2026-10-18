import { formatTimeLocale, getLocale } from "../i18n";
import type { Note } from "../models";

export function isoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return isoDate(value);
}

export function isoWeek(date: Date): number {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  return Math.ceil(((value.getTime() - Date.UTC(value.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

export function validIsoDate(value: string | null): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()));
}

export function formatTime(createdAt: string, noteDate: string): string {
  return formatTimeLocale(createdAt, noteDate, isoDate(new Date()), getLocale());
}

export function tagCounts(items: Note[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  items.forEach((note) => note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
