import { normalize } from "../services";
import type { ParsedSearch } from "./types";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseSearchQuery(query: string, cursorIndex?: number): ParsedSearch {
  const raw = query ?? "";
  let working = raw;

  const tags: string[] = [];
  let hasTask: boolean | undefined = undefined;
  let after: string | undefined = undefined;
  let before: string | undefined = undefined;

  // Check for active filter at cursor/end for autocomplete suggestions
  const pos = typeof cursorIndex === "number" && cursorIndex >= 0 ? cursorIndex : raw.length;
  const beforeCursor = raw.slice(0, pos);
  const activeMatch = beforeCursor.match(/(?:^|\s)(tag):([^\s]*)$/i);
  let activeFilter: ParsedSearch["activeFilter"] = null;

  if (activeMatch) {
    const type = "tag" as const;
    const value = activeMatch[2];
    const startIndex = (activeMatch.index ?? 0) + (activeMatch[0].startsWith(" ") ? 1 : 0);
    activeFilter = { type, value, startIndex };
  }

  // Extract tag: filters
  working = working.replace(/(?:^|\s)tag:([^\s]+)/gi, (_, val) => {
    const clean = normalize(val.replace(/^#/, ""));
    if (clean) tags.push(clean);
    return " ";
  });

  // Extract has:task or has:todo
  if (/(?:^|\s)has:(?:task|todo)(?:\s|$)/i.test(working)) {
    hasTask = true;
    working = working.replace(/(?:^|\s)has:(?:task|todo)(?:\s|$)/gi, " ");
  }

  // Extract after:YYYY-MM-DD
  working = working.replace(/(?:^|\s)after:([^\s]+)/gi, (_, val) => {
    if (DATE_REGEX.test(val)) after = val;
    return " ";
  });

  // Extract before:YYYY-MM-DD
  working = working.replace(/(?:^|\s)before:([^\s]+)/gi, (_, val) => {
    if (DATE_REGEX.test(val)) before = val;
    return " ";
  });

  const text = working.replace(/\s+/g, " ").trim();

  return {
    raw,
    text,
    tags,
    hasTask,
    after,
    before,
    activeFilter
  };
}

export function insertFilterValue(
  query: string,
  filterType: "tag",
  value: string
): string {
  // If active filter is at the end, replace it
  const regex = new RegExp(`(?:^|\\s)${filterType}:[^\\s]*$`, "i");
  if (regex.test(query)) {
    return query.replace(regex, (match) => {
      const leadingSpace = match.startsWith(" ") ? " " : "";
      return `${leadingSpace}${filterType}:${value} `;
    });
  }

  // Otherwise append it
  const trimmed = query.trim();
  return trimmed ? `${trimmed} ${filterType}:${value} ` : `${filterType}:${value} `;
}
