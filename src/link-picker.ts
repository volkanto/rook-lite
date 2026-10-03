import { formatShortDate } from "./i18n";
import type { Note } from "./models";

export interface LinkPickerItem {
  id: string;
  target: string;
  badge: string;
  line: string;
  tag?: string;
  type: "date" | "note";
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Extracts a single clean sentence/summary from note markdown.
 */
export function extractCleanFirstLine(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  for (const rawLine of lines) {
    const cleaned = rawLine
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "")
      .replace(/^>\s+/, "")
      .trim();
    if (cleaned && !cleaned.startsWith("#")) {
      return cleaned.slice(0, 140);
    }
  }
  return markdown.replace(/^#{1,6}\s+/gm, "").replace(/\s+/g, " ").trim().slice(0, 140) || "Empty note";
}

export interface LinkPickerLabels {
  todayBadge?: string;
  yesterdayBadge?: string;
  dateBadge?: string;
  todayLabel?: string;
  yesterdayLabel?: string;
}

/**
 * Builds and filters the list of selectable dates and notes for the link picker
 * in a sleek, single-line ledger format (Spotlight / Raycast style).
 */
export function getLinkPickerCandidates(
  query: string,
  allNotes: Note[],
  maxNotes = 30,
  labels?: LinkPickerLabels
): { dates: LinkPickerItem[]; notes: LinkPickerItem[] } {
  const q = query.trim().toLowerCase();

  // 1. Dates
  const today = toIsoDate(new Date());
  const yesterday = shiftIsoDate(today, -1);
  const twoDaysAgo = shiftIsoDate(today, -2);

  const todayBadge = labels?.todayBadge ?? "Today";
  const yesterdayBadge = labels?.yesterdayBadge ?? "Yday";
  const dateBadge = labels?.dateBadge ?? "Date";
  const todayLabel = labels?.todayLabel ?? "Today";
  const yesterdayLabel = labels?.yesterdayLabel ?? "Yesterday";

  const candidateDates = [
    { target: today, label: `${today} (${todayLabel})`, badge: todayBadge },
    { target: yesterday, label: `${yesterday} (${yesterdayLabel})`, badge: yesterdayBadge },
    { target: twoDaysAgo, label: `${twoDaysAgo}`, badge: dateBadge }
  ];

  const matchedDates: LinkPickerItem[] = [];
  for (const item of candidateDates) {
    if (!q || item.target.includes(q) || item.label.toLowerCase().includes(q)) {
      matchedDates.push({
        id: `date-${item.target}`,
        target: item.target,
        badge: item.badge,
        line: item.label,
        type: "date"
      });
    }
  }

  // 2. Notes
  const matchedNotes: LinkPickerItem[] = [];
  const sortedNotes = [...allNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const note of sortedNotes) {
    if (!note.content.trim()) continue;

    const summaryLine = extractCleanFirstLine(note.content);
    const dateFormatted = formatShortDate(note.noteDate);

    const matchesQuery =
      !q ||
      note.noteDate.includes(q) ||
      summaryLine.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q) ||
      note.tags.some((t) => t.toLowerCase().includes(q));

    if (matchesQuery) {
      const target = note.title && note.title.trim() ? note.title.trim() : `${note.noteDate}#note-${note.id}`;
      const primaryTag = note.tags.length ? note.tags[0] : undefined;

      matchedNotes.push({
        id: `note-${note.id}`,
        target,
        badge: dateFormatted,
        line: summaryLine,
        tag: primaryTag,
        type: "note"
      });

      if (matchedNotes.length >= maxNotes) break;
    }
  }

  return { dates: matchedDates, notes: matchedNotes };
}

/**
 * Generates the wikilink syntax to insert into the textarea.
 */
export function buildWikilinkInsertion(target: string, selectedText?: string): string {
  const cleanTarget = target.trim();
  const cleanSelected = (selectedText ?? "").trim();

  if (cleanSelected && cleanSelected.toLowerCase() !== cleanTarget.toLowerCase()) {
    return `[[${cleanTarget}|${cleanSelected}]]`;
  }
  return `[[${cleanTarget}]]`;
}
