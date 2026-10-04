import type { Note } from "./models";

export interface WikilinkItem {
  raw: string;
  target: string;
  label: string;
  isDate: boolean;
  date?: string;
  anchor?: string;
}

export interface BacklinkItem {
  sourceNote: Note;
  target: string;
  snippet: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses all [[target|label]] or [[target]] occurrences in text,
 * ignoring text within fenced code blocks and inline code snippets.
 */
export function extractWikilinks(markdown: string): WikilinkItem[] {
  // Strip code blocks and inline code
  const stripped = markdown.replace(/```[\s\S]*?```|`[^`]*`/g, "");
  const regex = /\[\[([^[\]\r\n|]+)(?:\|([^[\]\r\n]+))?\]\]/g;
  const results: WikilinkItem[] = [];

  for (const match of stripped.matchAll(regex)) {
    const raw = match[0];
    const fullTarget = match[1].trim();
    const label = (match[2] ?? match[1]).trim();

    let target = fullTarget;
    let anchor: string | undefined;

    if (fullTarget.includes("#")) {
      const parts = fullTarget.split("#");
      target = parts[0].trim();
      anchor = parts[1].trim();
    }

    const isDate = ISO_DATE_REGEX.test(target);

    results.push({
      raw,
      target,
      label,
      isDate,
      date: isDate ? target : undefined,
      anchor
    });
  }

  return results;
}

let cachedNotesIndex: Note[] = [];

export function setWikilinkNotesIndex(notes: Note[]): void {
  cachedNotesIndex = notes;
}

/**
 * Formats a Wikilink into HTML markup suitable for rendering inside Markdown.
 * Wikilinks strictly target dates and notes.
 */
export function renderWikilinkHtml(target: string, label?: string): string {
  const displayLabel = (label && label.trim()) ? label.trim() : target.trim();
  let cleanTarget = target.trim();
  let anchor: string | undefined;

  if (cleanTarget.includes("#")) {
    const parts = cleanTarget.split("#");
    cleanTarget = parts[0].trim();
    anchor = parts[1].trim();
  }

  const isDate = ISO_DATE_REGEX.test(cleanTarget);
  let href: string;
  let typeClass: string;

  if (isDate) {
    const hash = anchor ? (anchor.startsWith("note-") ? `#${anchor}` : `#note-${anchor}`) : "";
    href = `/?date=${encodeURIComponent(cleanTarget)}${hash}`;
    typeClass = "wikilink-date";
  } else {
    // Note reference (by Title or ID)
    const targetLower = cleanTarget.toLowerCase();
    const matchedNote = cachedNotesIndex.find(
      (n) => n.id === cleanTarget || (n.title && n.title.trim().toLowerCase() === targetLower)
    );

    if (matchedNote) {
      href = `/?date=${encodeURIComponent(matchedNote.noteDate)}#note-${encodeURIComponent(matchedNote.id)}`;
      typeClass = "wikilink-note";
    } else if (cleanTarget.startsWith("note-")) {
      href = `/#${encodeURIComponent(cleanTarget)}`;
      typeClass = "wikilink-note";
    } else {
      // Unresolved note reference
      href = `/?date=${encodeURIComponent(cleanTarget)}`;
      typeClass = "wikilink-note";
    }
  }

  return `<a href="${href}" data-link class="wikilink ${typeClass}" data-wikilink-target="${escapeAttr(cleanTarget)}">${escapeText(displayLabel)}</a>`;
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeText(text).replace(/"/g, "&quot;");
}

/**
 * Extracts a concise snippet from markdown surrounding a given target mention.
 */
export function extractSnippetAroundTarget(content: string, target: string, maxLength = 120): string {
  const lines = content.split(/\r?\n/);
  const targetLower = target.toLowerCase();

  for (const line of lines) {
    if (line.toLowerCase().includes(targetLower)) {
      const cleaned = line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "")
        .trim();

      if (cleaned.length <= maxLength) return cleaned;
      const idx = cleaned.toLowerCase().indexOf(targetLower);
      const start = Math.max(0, idx - 40);
      const end = Math.min(cleaned.length, start + maxLength);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < cleaned.length ? "…" : "";
      return `${prefix}${cleaned.slice(start, end).trim()}${suffix}`;
    }
  }

  return content.slice(0, maxLength).trim();
}

/**
 * Finds all backlinks pointing to a specific note across the entire notebook.
 */
export function findNoteBacklinks(targetNote: Note, allNotes: Note[]): BacklinkItem[] {
  const backlinks: BacklinkItem[] = [];
  const targetDate = targetNote.noteDate;
  const targetTitle = targetNote.title?.trim().toLowerCase();
  const targetId = targetNote.id;

  for (const note of allNotes) {
    if (note.id === targetId) continue;

    const links = extractWikilinks(note.content);
    for (const link of links) {
      const linkTargetLower = link.target.toLowerCase();
      const matchesDate = link.isDate && link.target === targetDate && (!link.anchor || link.anchor === targetId);
      const matchesTitle = Boolean(targetTitle && linkTargetLower === targetTitle);
      const matchesId = link.target === targetId || link.anchor === targetId;

      if (matchesDate || matchesTitle || matchesId) {
        backlinks.push({
          sourceNote: note,
          target: link.target,
          snippet: extractSnippetAroundTarget(note.content, link.raw)
        });
        break; // Only one backlink entry per source note
      }
    }
  }

  return backlinks;
}

/**
 * Finds all backlinks pointing to a specific date from notes on different dates.
 */
export function findDateBacklinks(date: string, allNotes: Note[]): BacklinkItem[] {
  const backlinks: BacklinkItem[] = [];

  for (const note of allNotes) {
    if (note.noteDate === date) continue;

    const links = extractWikilinks(note.content);
    for (const link of links) {
      if (link.isDate && link.target === date) {
        backlinks.push({
          sourceNote: note,
          target: link.target,
          snippet: extractSnippetAroundTarget(note.content, link.raw)
        });
        break;
      }
    }
  }

  return backlinks;
}
