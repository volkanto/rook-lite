export function stripMarkdown(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(`{1,3})([\s\S]*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/^\s*>\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
import { currentStrings } from "../i18n";
import type { Category, Note } from "../models";
import { normalize } from "../services";
import { parseSearchQuery } from "./searchParser";
import type {
  Command,
  CommandContext,
  PaletteCommandItem,
  PaletteNoteItem,
  PaletteSection,
  PaletteSuggestionItem,
  PaletteTaskItem,
  RecentCommand
} from "./types";

const QUICK_COMMAND_IDS = ["new-note", "today", "review-this-week", "open-tasks"];

export function searchPalette(
  query: string,
  commands: Command[],
  recentCommands: RecentCommand[],
  notes: Note[],
  categories: Category[],
  context: CommandContext
): PaletteSection[] {
  const trimmed = query.trim();
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const availableCommands = commands.filter((cmd) => (cmd.isAvailable ? cmd.isAvailable(context) : true));
  const recentMap = new Map(recentCommands.map((rc) => [rc.id, rc]));

  // Branch 1: Autocomplete mode for filter prefixes
  const parsed = parseSearchQuery(query);
  if (parsed.activeFilter) {
    const val = normalize(parsed.activeFilter.value);
    const isExactCategory =
      parsed.activeFilter.type === "category" &&
      val.length > 0 &&
      categories.some((c) => normalize(c.name) === val || c.slug === val);
    const isExactTag =
      parsed.activeFilter.type === "tag" &&
      val.length > 0 &&
      notes.some((n) => n.tags.some((t) => normalize(t) === val));

    if (!isExactCategory && !isExactTag) {
      return [getAutocompleteSection(parsed.activeFilter, notes, categories)];
    }
  }

  // Branch 2: Explicit open tasks query
  if (trimmed === "> Open tasks" || trimmed === "has:task" || trimmed === "has:todo") {
    const tasks = getOpenTasks(notes, categoryMap);
    return [{ title: "Open Tasks", items: tasks }];
  }

  // Branch 3: Command mode (starts with '>')
  if (trimmed.startsWith(">")) {
    const commandText = trimmed.slice(1).trim();
    return getCommandModeSections(commandText, availableCommands, recentMap);
  }

  // Branch 4: Empty search query (Default layout)
  if (!trimmed) {
    return getEmptyQuerySections(availableCommands, recentMap, notes, categoryMap);
  }

  // Branch 5: General search query (searches notes & commands)
  return getGeneralSearchSections(query, availableCommands, recentMap, notes, categoryMap);
}

function getAutocompleteSection(
  filter: NonNullable<ReturnType<typeof parseSearchQuery>["activeFilter"]>,
  notes: Note[],
  categories: Category[]
): PaletteSection {
  const filterVal = normalize(filter.value);

  if (filter.type === "tag") {
    const tagCounts = new Map<string, number>();
    notes.forEach((n) => {
      n.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      });
    });

    const suggestions: PaletteSuggestionItem[] = Array.from(tagCounts.entries())
      .filter(([tag]) => !filterVal || normalize(tag).includes(filterVal))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tag, count]) => ({
        type: "suggestion",
        id: `tag-${tag}`,
        filterType: "tag",
        value: tag,
        label: `#${tag}`,
        count
      }));

    return { title: "Tags", items: suggestions };
  }

  const suggestions: PaletteSuggestionItem[] = categories
    .filter((c) => !c.archived && (!filterVal || normalize(c.name).includes(filterVal) || c.slug.includes(filterVal)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map((category) => ({
      type: "suggestion",
      id: `category-${category.id}`,
      filterType: "category",
      value: category.name,
      label: category.name
    }));

  return { title: "Categories", items: suggestions };
}

function getOpenTasks(notes: Note[], categoryMap: Map<string, string>): PaletteTaskItem[] {
  const taskItems: PaletteTaskItem[] = [];
  const unarchived = notes
    .filter((n) => !n.archived)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.updatedAt.localeCompare(a.updatedAt));

  for (const note of unarchived) {
    const lines = note.content.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      if (/^\s*[-*+]\s+\[ \]\s+/.test(line)) {
        const taskText = line.replace(/^\s*[-*+]\s+\[ \]\s+/, "").trim();
        const categoryName = note.categoryIds.map((id) => categoryMap.get(id)).filter(Boolean)[0];
        taskItems.push({
          type: "task",
          id: `task-${note.id}-${lineIndex}`,
          noteId: note.id,
          taskText,
          noteDate: note.noteDate,
          categoryName,
          lineIndex,
          href: `/?date=${note.noteDate}#note-${note.id}`
        });
      }
    });
  }

  return taskItems;
}

function getCommandModeSections(
  commandText: string,
  availableCommands: Command[],
  recentMap: Map<string, RecentCommand>
): PaletteSection[] {
  if (!commandText) {
    // Show quick actions + remaining commands grouped
    const contextual = availableCommands.filter((c) => c.group === "contextual");
    const other = availableCommands.filter((c) => c.group !== "contextual");

    const sections: PaletteSection[] = [];
    if (contextual.length) {
      sections.push({
        title: "Current Context",
        items: contextual.map(toCommandItem)
      });
    }

    sections.push({
      title: "Commands",
      items: other.map(toCommandItem)
    });

    return sections;
  }

  const queryNorm = normalize(commandText);
  const scored = availableCommands
    .map((cmd) => {
      let score = 0;
      const titleNorm = normalize(cmd.title);
      const descNorm = cmd.description ? normalize(cmd.description) : "";

      if (titleNorm === queryNorm) score += 100;
      else if (titleNorm.startsWith(queryNorm)) score += 80;
      else if (titleNorm.includes(queryNorm)) score += 60;

      for (const kw of cmd.keywords) {
        const kwNorm = normalize(kw);
        if (kwNorm === queryNorm) score += 70;
        else if (kwNorm.startsWith(queryNorm)) score += 50;
        else if (kwNorm.includes(queryNorm)) score += 40;
      }

      if (descNorm.includes(queryNorm)) score += 20;

      if (recentMap.has(cmd.id) && score > 0) {
        score += 15;
      }

      return { cmd, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.cmd.title.localeCompare(b.cmd.title));

  return [
    {
      title: "Commands",
      items: scored.map((s) => toCommandItem(s.cmd))
    }
  ];
}

function getEmptyQuerySections(
  availableCommands: Command[],
  recentMap: Map<string, RecentCommand>,
  notes: Note[],
  categoryMap: Map<string, string>
): PaletteSection[] {
  const sections: PaletteSection[] = [];

  // 1. Contextual commands
  const contextual = availableCommands.filter((c) => c.group === "contextual");
  if (contextual.length) {
    sections.push({
      title: "Current Context",
      items: contextual.map(toCommandItem)
    });
  }

  // 2. Quick Actions
  const quick = availableCommands.filter((c) => QUICK_COMMAND_IDS.includes(c.id));
  if (quick.length) {
    sections.push({
      title: "Quick",
      items: quick.map(toCommandItem)
    });
  }

  // 3. Recent Commands (excluding ones already in contextual or quick)
  const excludedIds = new Set([...contextual.map((c) => c.id), ...quick.map((c) => c.id)]);
  const recentItems = Array.from(recentMap.values())
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map((rc) => availableCommands.find((c) => c.id === rc.id))
    .filter((c): c is Command => Boolean(c) && !excludedIds.has((c as Command).id))
    .slice(0, 4)
    .map(toCommandItem);

  if (recentItems.length) {
    sections.push({
      title: "Recent",
      items: recentItems
    });
  }

  // 4. Recent Notes
  const recentNotes = notes
    .filter((n) => !n.archived)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((note) => toNoteItem(note, categoryMap, ""));

  if (recentNotes.length) {
    sections.push({
      title: "Recent Notes",
      items: recentNotes
    });
  }

  return sections;
}

function getGeneralSearchSections(
  query: string,
  availableCommands: Command[],
  recentMap: Map<string, RecentCommand>,
  notes: Note[],
  categoryMap: Map<string, string>
): PaletteSection[] {
  const parsed = parseSearchQuery(query);
  const textNorm = normalize(parsed.text);
  const sections: PaletteSection[] = [];

  // Filter notes
  const matchingNotes: { note: PaletteNoteItem; score: number }[] = [];

  for (const note of notes) {
    if (note.archived) continue;
    if (parsed.after && note.noteDate < parsed.after) continue;
    if (parsed.before && note.noteDate > parsed.before) continue;
    if (parsed.tags.length && !parsed.tags.every((t) => note.tags.some((nt) => normalize(nt) === t))) continue;

    if (parsed.categories.length) {
      const noteCatNames = note.categoryIds.map((id) => normalize(categoryMap.get(id) ?? ""));
      if (!parsed.categories.some((c) => noteCatNames.includes(c))) continue;
    }

    const openTasks = note.content.split(/\r?\n/).filter((line) => /^\s*[-*+]\s+\[ \]\s+/.test(line));
    if (parsed.hasTask && openTasks.length === 0) continue;

    let score = 0;
    if (textNorm) {
      const titleNorm = normalize(note.title ?? "");
      const contentNorm = normalize(note.content);
      const tagsNorm = note.tags.map(normalize).join(" ");
      const catNorm = note.categoryIds.map((id) => normalize(categoryMap.get(id) ?? "")).join(" ");

      if (titleNorm.includes(textNorm)) {
        score += titleNorm.startsWith(textNorm) ? 100 : 80;
      }
      if (tagsNorm.includes(textNorm)) {
        score += 60;
      }
      if (catNorm.includes(textNorm)) {
        score += 50;
      }
      if (contentNorm.includes(textNorm)) {
        score += 40;
      }

      if (score === 0) continue;
    } else {
      score = 100;
    }

    matchingNotes.push({
      note: toNoteItem(note, categoryMap, parsed.text),
      score
    });
  }

  // Sort notes by score desc, then date desc
  matchingNotes.sort((a, b) => b.score - a.score || b.note.noteDate.localeCompare(a.note.noteDate));

  // Match commands if textNorm is present
  const matchingCommands: PaletteCommandItem[] = [];
  if (textNorm) {
    for (const cmd of availableCommands) {
      let cmdScore = 0;
      const titleNorm = normalize(cmd.title);
      if (titleNorm === textNorm) cmdScore += 100;
      else if (titleNorm.startsWith(textNorm)) cmdScore += 80;
      else if (titleNorm.includes(textNorm)) cmdScore += 60;

      for (const kw of cmd.keywords) {
        const kwNorm = normalize(kw);
        if (kwNorm === textNorm) cmdScore += 70;
        else if (kwNorm.startsWith(textNorm)) cmdScore += 50;
        else if (kwNorm.includes(textNorm)) cmdScore += 40;
      }

      if (recentMap.has(cmd.id) && cmdScore > 0) cmdScore += 10;
      if (cmdScore > 0) {
        matchingCommands.push(toCommandItem(cmd));
      }
    }
  }

  // Split into strong note matches, commands, and other note matches
  const strongNotes = matchingNotes.filter((m) => m.score >= 60).map((m) => m.note);
  const otherNotes = matchingNotes.filter((m) => m.score < 60).map((m) => m.note);
  const s = currentStrings();

  if (strongNotes.length) {
    sections.push({
      title: s.sectionNotes,
      items: strongNotes.slice(0, 8)
    });
  }

  if (matchingCommands.length) {
    sections.push({
      title: s.sectionCommands,
      items: matchingCommands.slice(0, 5)
    });
  }

  if (otherNotes.length) {
    if (!strongNotes.length) {
      sections.push({
        title: s.sectionNotes,
        items: otherNotes.slice(0, 8)
      });
    } else {
      sections.push({
        title: s.sectionMoreNotes,
        items: otherNotes.slice(0, 6)
      });
    }
  }

  return sections;
}

function toCommandItem(cmd: Command): PaletteCommandItem {
  return {
    type: "command",
    id: cmd.id,
    title: cmd.title,
    description: cmd.description,
    shortcut: cmd.shortcut,
    icon: cmd.icon,
    group: cmd.group,
    command: cmd
  };
}

function toNoteItem(note: Note, categoryMap: Map<string, string>, searchTerm: string): PaletteNoteItem {
  const categoryName = note.categoryIds.map((id) => categoryMap.get(id)).filter(Boolean)[0];
  const openTasks = note.content.split(/\r?\n/).filter((l) => /^\s*[-*+]\s+\[ \]\s+/.test(l));

  return {
    type: "note",
    id: note.id,
    title: note.title || "Untitled note",
    contentExcerpt: extractSnippet(note.content, searchTerm),
    noteDate: note.noteDate,
    categoryName,
    tags: note.tags,
    openTaskCount: openTasks.length,
    href: `/?date=${note.noteDate}#note-${note.id}`,
    note
  };
}

export function extractSnippet(content: string, searchTerm: string, maxLen = 140): string {
  const clean = stripMarkdown(content);
  if (!clean) return "";

  if (!searchTerm) {
    return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen)}…`;
  }

  const termNorm = normalize(searchTerm);
  const cleanNorm = normalize(clean);
  const matchIndex = cleanNorm.indexOf(termNorm);

  if (matchIndex === -1) {
    return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen)}…`;
  }

  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(clean.length, matchIndex + termNorm.length + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";

  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}
