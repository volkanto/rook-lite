import { track } from "../analytics/analytics";
import { icons, svg } from "../icons";
import {
  currentStrings,
  formatDateHeading,
  formatMonthYear,
  formatShortDate,
  getLocale,
  getLocaleDefinition,
  getRelativeDateInfo
} from "../i18n";
import { escapeHtml, renderInlineMarkdown, renderMarkdown, toggleTaskInMarkdown } from "../markdown";
import type { Folder, Note } from "../models";
import { appUrl, assetUrl } from "../routing";
import { folders, notes } from "../servicesContext";
import { attachTagAutocomplete } from "../tag-autocomplete";
import { formatTime, isoDate, isoWeek, shiftDate, tagCounts, validIsoDate } from "../utils/date";
import { errorMessage, requireElement, setBusy, status, updateScrollToTopVisibility } from "../utils/dom";
import { findDateBacklinks, findNoteBacklinks, setWikilinkNotesIndex } from "../wikilinks";
import { bindFormatting } from "../editor/formatting";
import {
  bindEditorPreview,
  editorMarkup,
  resizeEditor,
  setEditorMode,
  updateEditorWordCount
} from "../editor/toolbar";
import { setCalendarRefresher, setSplitEditorRestorer, setSplitNoteSelector, showComposeDrawer, showConfirm, showEditDialog, showLinkPickerModal } from "../editor/modals";
import { getNotesPageLayout, setNotesPageLayout } from "../notesLayout";
import { renderRoute } from "../router";

let draftTimer: number | undefined;

export type SearchOpener = (query?: string) => Promise<void>;
let activeSearchOpener: SearchOpener | null = null;
export function setSearchOpener(opener: SearchOpener): void {
  activeSearchOpener = opener;
}

export function highlightLinkedNote(targetId?: string): void {
  const hash = targetId ? (targetId.startsWith("#") ? targetId : `#${targetId}`) : location.hash;
  if (!hash.startsWith("#note-")) return;
  const note = document.querySelector<HTMLElement>(hash);
  if (!note) return;

  note.classList.remove("is-search-target");
  void note.offsetWidth;

  requestAnimationFrame(() => {
    if (typeof note.scrollIntoView === "function") {
      note.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center"
      });
    }
    note.classList.add("is-search-target");
    window.setTimeout(() => note.classList.remove("is-search-target"), 3200);
  });
}

export function parseSelectedTags(search: string): string[] {
  const params = new URLSearchParams(search);
  const values = params.getAll("tag");
  const tags = new Set<string>();
  for (const v of values) {
    for (const part of v.split(",")) {
      const trimmed = part.trim();
      if (trimmed) tags.add(trimmed);
    }
  }
  return Array.from(tags);
}

export async function renderToday(content: HTMLElement): Promise<void> {
  const existingTagPicker = document.querySelector<HTMLDetailsElement>("#tag-picker");
  const wasTagPickerOpen = existingTagPicker?.hasAttribute("open") ?? false;
  const tagListScrollTop = existingTagPicker?.querySelector<HTMLElement>(".tag-popover-list")?.scrollTop ?? 0;

  const s = currentStrings();
  const requested = new URLSearchParams(location.search).get("date");
  const today = isoDate(new Date());
  const date = validIsoDate(requested) ? (requested as string) : today;
  const isToday = date === today;
  const value = new Date(`${date}T12:00:00`);
  const [allNotes, allFolders] = await Promise.all([notes.listAll(), folders.listAll()]);
  setWikilinkNotesIndex(allNotes);
  const dayNotes = await notes.listByDate(date);
  const draft = await notes.getDraft(date);
  const dayBacklinks = findDateBacklinks(date, allNotes);
  const heading = formatDateHeading(date);
  const previous = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  const selectedTags = parseSelectedTags(location.search);
  const requestedFolder = new URLSearchParams(location.search).get("folder");

  let activeFolderId: string | null = null;
  if (requestedFolder === "unfiled") {
    activeFolderId = "unfiled";
  } else if (requestedFolder && allFolders.some((f) => f.id === requestedFolder)) {
    activeFolderId = requestedFolder;
  }

  let filteredByFolder = dayNotes;
  if (activeFolderId === "unfiled") {
    filteredByFolder = dayNotes.filter((note) => !note.folderId);
  } else if (activeFolderId) {
    filteredByFolder = dayNotes.filter((note) => note.folderId === activeFolderId);
  }

  const visibleNotes = selectedTags.length
    ? filteredByFolder.filter((note) => selectedTags.every((t) => note.tags.includes(t)))
    : filteredByFolder;
  const allFolderTags = tagCounts(filteredByFolder);
  document.title = `${heading} · Rook Lite`;

  const relativeInfo = getRelativeDateInfo(date, today, getLocale());

  const folderCounts = new Map<string, number>();
  dayNotes.forEach((n) => {
    if (n.folderId) folderCounts.set(n.folderId, (folderCounts.get(n.folderId) ?? 0) + 1);
  });
  const unfiledCount = dayNotes.filter((n) => !n.folderId).length;

  const isUserFolder = Boolean(activeFolderId && activeFolderId !== "unfiled");
  const targetNewNoteFolderId = isUserFolder ? activeFolderId : null;

  const buildFolderUrl = (folderParam: string | null): string => {
    const params = new URLSearchParams({ date });
    if (folderParam) params.set("folder", folderParam);
    if (selectedTags.length) params.set("tag", selectedTags.join(","));
    return appUrl(`/?${params}`);
  };

  const buildTagUrl = (tagToToggle: string | null): string => {
    const params = new URLSearchParams({ date });
    if (activeFolderId) params.set("folder", activeFolderId);
    if (tagToToggle === null) {
      return appUrl(`/?${params}`);
    }
    const nextTags = selectedTags.includes(tagToToggle)
      ? selectedTags.filter((t) => t !== tagToToggle)
      : [...selectedTags, tagToToggle];
    if (nextTags.length) params.set("tag", nextTags.join(","));
    return appUrl(`/?${params}`);
  };

  const prevParams = new URLSearchParams({ date: previous });
  if (activeFolderId) prevParams.set("folder", activeFolderId);
  if (selectedTags.length) prevParams.set("tag", selectedTags.join(","));

  const nextParams = new URLSearchParams({ date: next });
  if (activeFolderId) nextParams.set("folder", activeFolderId);
  if (selectedTags.length) nextParams.set("tag", selectedTags.join(","));

  const todayParams = new URLSearchParams();
  if (activeFolderId) todayParams.set("folder", activeFolderId);
  if (selectedTags.length) todayParams.set("tag", selectedTags.join(","));
  const todayHref = todayParams.toString() ? appUrl(`/?${todayParams}`) : appUrl("/");

  const currentFolder = isUserFolder ? allFolders.find((f) => f.id === activeFolderId) : null;

  let activeFolderLabel = s.folderAllNotes;
  let activeFolderCount = dayNotes.length;
  if (activeFolderId === "unfiled") {
    activeFolderLabel = s.folderUnfiled;
    activeFolderCount = unfiledCount;
  } else if (currentFolder) {
    activeFolderLabel = currentFolder.name;
    activeFolderCount = folderCounts.get(currentFolder.id) ?? 0;
  }

  const folderControl = `<details class="filter-dropdown folder-filter-dropdown" id="folder-picker"><summary class="filter-dropdown-btn ${isUserFolder ? "is-filtered" : ""}" aria-haspopup="menu" aria-label="${s.folderFilterAria}" title="${s.folderFilterAria}">${svg(icons.folder, "filter-btn-icon")}<span class="filter-btn-label">${escapeHtml(activeFolderLabel)}</span><span class="filter-btn-badge">${activeFolderCount}</span>${svg(icons.chevronDown, "filter-btn-chevron")}</summary><div class="filter-dropdown-popover" role="menu"><div class="filter-popover-title">${s.selectFolder}</div><a href="${buildFolderUrl(null)}" data-link class="filter-popover-item ${activeFolderId === null ? "is-active" : ""}" role="menuitem">${svg(icons.note, "filter-item-icon")}<span class="filter-item-name">${s.folderAllNotes}</span><span class="filter-item-count">${dayNotes.length}</span>${activeFolderId === null ? svg(icons.check, "folder-check-svg") : ""}</a><a href="${buildFolderUrl("unfiled")}" data-link class="filter-popover-item ${activeFolderId === "unfiled" ? "is-active" : ""}" role="menuitem">${svg(icons.folder, "filter-item-icon")}<span class="filter-item-name">${s.folderUnfiled}</span><span class="filter-item-count">${unfiledCount}</span>${activeFolderId === "unfiled" ? svg(icons.check, "folder-check-svg") : ""}</a>${allFolders.length ? '<div class="filter-popover-sep" role="separator"></div>' : ""}${allFolders.map((f) => `<div class="filter-folder-row ${activeFolderId === f.id ? "is-active" : ""}"><a href="${buildFolderUrl(f.id)}" data-link class="filter-popover-item filter-folder-link" role="menuitem">${svg(icons.folder, "filter-item-icon")}<span class="filter-item-name">${escapeHtml(f.name)}</span><span class="filter-item-count">${folderCounts.get(f.id) ?? 0}</span>${activeFolderId === f.id ? svg(icons.check, "folder-check-svg") : ""}</a><div class="filter-folder-actions"><button type="button" class="folder-row-action-btn" data-action="rename-folder" data-folder-id="${f.id}" aria-label="${s.renameFolder}" title="${s.renameFolder}">${svg(icons.edit, "folder-action-svg")}</button><button type="button" class="folder-row-action-btn delete-btn" data-action="delete-folder" data-folder-id="${f.id}" aria-label="${s.deleteFolderBtn}" title="${s.deleteFolderBtn}">${svg(icons.trash, "folder-action-svg")}</button></div></div>`).join("")}<div class="filter-popover-sep" role="separator"></div><button type="button" class="filter-popover-item filter-create-folder-btn" data-action="create-folder" role="menuitem">${svg(icons.folderPlus, "filter-item-icon")}<span>${s.createFolder}…</span></button></div></details>`;

  let tagButtonLabel = s.filterTags;
  if (selectedTags.length === 1) {
    tagButtonLabel = selectedTags[0];
  }

  const tagControl = allFolderTags.length ? `<span class="filter-bar-divider" aria-hidden="true"></span><details class="filter-dropdown tag-filter-dropdown" id="tag-picker"><summary class="filter-dropdown-btn ${selectedTags.length ? "is-filtered" : ""}" aria-haspopup="menu" aria-label="${s.filterByTag}" title="${s.filterByTag}">${svg(icons.hash, "filter-btn-icon")}<span class="filter-btn-label">${escapeHtml(tagButtonLabel)}</span>${selectedTags.length > 1 ? `<span class="filter-btn-badge">${selectedTags.length}</span>` : ""}${svg(icons.chevronDown, "filter-btn-chevron")}</summary><div class="filter-dropdown-popover tag-dropdown-popover" role="menu"><div class="filter-popover-header-row"><span class="filter-popover-title">${s.filterByTag}</span>${selectedTags.length ? `<a href="${buildTagUrl(null)}" data-link class="filter-popover-clear" title="${s.clearFilters}">${s.clearFilters}</a>` : ""}</div><div class="tag-popover-list">${allFolderTags.map(([tag, count]) => {
    const isChecked = selectedTags.includes(tag);
    return `<a href="${buildTagUrl(tag)}" data-link class="tag-popover-item ${isChecked ? "is-checked" : ""}" role="menuitemcheckbox" aria-checked="${isChecked}"><span class="tag-checkbox-box ${isChecked ? "is-checked" : ""}">${isChecked ? svg(icons.check, "tag-check-svg") : ""}</span><span class="tag-item-name">#${escapeHtml(tag)}</span><span class="filter-item-count">${count}</span></a>`;
  }).join("")}</div></div></details>${selectedTags.length ? `<a href="${buildTagUrl(null)}" data-link class="filter-clear-btn" aria-label="${s.clearFilters}" title="${s.clearFilters}">${svg(icons.close, "filter-clear-svg")}</a>` : ""}` : "";

  const hasDayNotes = dayNotes.length > 0;
  const isFiltered = Boolean(activeFolderId || selectedTags.length > 0);
  const isEmptyDayCanvas = !hasDayNotes && !isFiltered;
  const sectionHead = hasDayNotes ? `<div class="section-head"><div class="notes-panel-heading"><h2 id="day-notes-title">${s.notesTitle}</h2><span class="notes-count-badge">${visibleNotes.length} ${visibleNotes.length === 1 ? s.entrySingle : s.entryPlural}</span></div><div class="notes-head-controls"><div class="notes-filter-bar">${folderControl}${tagControl}</div></div></div>` : "";

  const layout = getNotesPageLayout();
  const dateHeaderMarkup = `<header class="notes-day-header minimal-date-header typewriter-masthead ${!isToday ? "is-historical-day" : ""}"><div class="minimal-date-bar"><div class="minimal-date-info typewriter-kicker-row"><span class="typewriter-pulse-dot ${!isToday ? "is-archived" : ""}" aria-hidden="true"></span><h1 class="minimal-date-title typewriter-kicker-label">${heading.toUpperCase()}</h1><span class="minimal-date-badge ${isToday ? "is-today" : "typewriter-kicker-badge"}"><span>${relativeInfo.label}</span></span></div><div class="minimal-date-nav" role="navigation" aria-label="${s.dateNavigation}">${!isToday ? `<a href="${todayHref}" data-link class="minimal-nav-btn today-jump-btn" aria-label="${s.today} (T)" title="${s.today} (T)">${svg(icons.recenter, "minimal-nav-svg")}</a>` : ""}<a href="${appUrl(`/?${prevParams}`)}" data-link class="minimal-nav-btn prev-btn date-nav-arrow" aria-label="${s.previousDay}" title="${s.previousDay}">${svg(icons.chevronLeft, "minimal-nav-svg")}</a><a href="${appUrl(`/?${nextParams}`)}" data-link class="minimal-nav-btn next-btn date-nav-arrow" aria-label="${s.nextDay}" title="${s.nextDay}">${svg(icons.chevronRight, "minimal-nav-svg")}</a><a href="${todayHref}" data-link class="minimal-today-link date-today-btn ${isToday ? "is-active" : ""}" ${isToday ? 'aria-disabled="true" tabindex="-1"' : `title="${s.today}"`}>${s.today}</a><button type="button" class="minimal-nav-btn notes-layout-toggle-btn" data-action="toggle-notes-layout" aria-label="${layout === 'one-column' ? s.layoutTwoColumns : s.layoutOneColumn}" title="${layout === 'one-column' ? s.layoutTwoColumns : s.layoutOneColumn}">${svg(layout === 'one-column' ? icons.columns : icons.layoutList, "minimal-nav-svg")}</button><details class="date-picker minimal-picker"><summary class="minimal-calendar-btn" aria-label="${s.openCalendar}" title="${s.openCalendar}">${svg(icons.calendar, "minimal-nav-svg")}</summary><div class="date-picker-popover" id="notes-calendar"></div></details></div></div></header>`;

  const notesPanelMarkup = `<section class="day-notes notes-panel ${isEmptyDayCanvas ? "is-empty-day" : ""}" aria-label="${s.notesTitle}">${sectionHead}${visibleNotes.length ? `<div class="notes-list">${visibleNotes.map((note) => noteMarkup(note, allNotes, date, allFolders)).join("")}</div><footer class="notes-stream-footer is-hidden" hidden><button type="button" class="back-to-top-link" data-action="scroll-to-top" aria-label="${s.backToTop}">${svg(icons.arrowUp, "back-to-top-icon")}<span>${s.backToTop}</span><kbd class="shortcut-kbd-hint">⌘↑</kbd></button></footer>` : `<div class="empty-notes ${isEmptyDayCanvas ? "empty-day-inspiration" : ""}">${isEmptyDayCanvas ? `<div class="inspiration-chips" role="toolbar" aria-label="${s.toolTemplates}"><button type="button" class="inspiration-chip" data-insert-template="standup">${svg(icons.sparkle, "inspiration-svg")}<span>${s.quickTemplateDaily}</span></button><button type="button" class="inspiration-chip" data-insert-template="meeting">${svg(icons.calendar, "inspiration-svg")}<span>${s.quickTemplateMeeting}</span></button><button type="button" class="inspiration-chip" data-insert-template="checklist">${svg(icons.check, "inspiration-svg")}<span>${s.quickTemplateChecklist}</span></button></div><p class="empty-day-prompt">${s.emptyDayPromptText}</p>` : `<img src="${assetUrl("/empty-notes.png")}" alt="" width="140" height="140" class="empty-notes-illustration" aria-hidden="true"><p>${activeFolderId && !selectedTags.length ? s.noNotesInFolder : (selectedTags.length ? s.noNotesForTag(selectedTags.join(", #")) : s.noNotesToday)}</p><span>${s.emptyNotesPrompt}</span>` }</div>`}</section>`;

  const backlinksMarkup = dayBacklinks.length ? `<section class="day-mentions-panel notes-panel" aria-labelledby="day-mentions-title"><div class="section-head"><div class="notes-panel-heading"><h3 id="day-mentions-title" class="panel-subtitle">${svg(icons.link, "backlink-icon-svg")}<span>${s.linkedMentionsTitle}</span></h3><span class="notes-count-badge">${dayBacklinks.length}</span></div></div><div class="day-mentions-list">${dayBacklinks.map((bl) => `<div class="day-mention-item"><a href="${appUrl(`/?date=${bl.sourceNote.noteDate}#note-${bl.sourceNote.id}`)}" data-link class="mention-date-badge" title="${s.openCalendar}">${formatShortDate(bl.sourceNote.noteDate)}</a><span class="day-mention-snippet-rendered prose">${renderInlineMarkdown(bl.snippet)}</span></div>`).join("")}</div></section>` : "";

  if (layout === "two-columns") {
    const activeNote = activeSplitNoteId ? allNotes.find((n) => n.id === activeSplitNoteId && !n.archived) ?? null : null;
    content.innerHTML = `<div class="notes-view-split-layout has-panel-open" id="notes-view-split-layout"><aside class="notes-stream-pane" id="notes-stream-pane">${dateHeaderMarkup}${notesPanelMarkup}${backlinksMarkup}</aside><section class="notes-split-panel is-open" id="notes-split-panel" role="complementary" aria-label="${s.notesTitle}">${renderSplitPanel(activeNote, draft?.content ?? "", targetNewNoteFolderId, allFolders, date, heading)}</section></div>`;
  } else {
    activeSplitNoteId = null;
    content.innerHTML = `${dateHeaderMarkup}<div class="copilot-input-container ${isEmptyDayCanvas ? "empty-day-composer typewriter-composer" : ""}">${editorMarkup("new-note-form", draft?.content ?? "", s.finishNote, false, targetNewNoteFolderId, allFolders, isEmptyDayCanvas)}</div>${notesPanelMarkup}${backlinksMarkup}<div class="floating-quick-note-container" id="floating-quick-note-container"><button type="button" class="floating-quick-note-btn" data-action="open-compose-drawer" aria-label="${s.newNote}" title="${s.newNote} (C)">${svg(icons.plus, "floating-quick-icon")}<span>${s.newNote}</span><kbd class="floating-quick-kbd">C</kbd></button></div>`;
  }
  renderCalendar(requireElement("#notes-calendar"), value, date, allNotes);
  if (wasTagPickerOpen) {
    const newTagPicker = document.querySelector<HTMLDetailsElement>("#tag-picker");
    if (newTagPicker) {
      newTagPicker.setAttribute("open", "");
      const newTagList = newTagPicker.querySelector<HTMLElement>(".tag-popover-list");
      if (newTagList && tagListScrollTop > 0) {
        newTagList.scrollTop = tagListScrollTop;
      }
    }
  }
  if (layout === "two-columns") {
    bindSplitPanel(date, allNotes, allFolders);
  } else {
    bindCreateEditor(date);
  }
  bindNoteActions();
  const createTitle = new URLSearchParams(location.search).get("create");
  if (createTitle) {
    const composer = document.querySelector<HTMLFormElement>("#new-note-form");
    const textarea = composer?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    if (composer && textarea) {
      const templateText = `# ${createTitle}\n\n`;
      if (!textarea.value.trim() || textarea.value.trim() === templateText.trim()) {
        textarea.value = templateText;
        setEditorMode(composer, "write", false);
        composer.classList.add("has-content");
        resizeEditor(textarea);
        updateEditorWordCount(composer);
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("create");
    history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
  updateScrollToTopVisibility();
  requestAnimationFrame(() => updateScrollToTopVisibility());
}

export function noteMarkup(
  note: Note,
  allNotes: Note[] = [],
  selectedDate = note.noteDate,
  allFolders: Folder[] = []
): string {
  const s = currentStrings();
  const backlinks = allNotes.length ? findNoteBacklinks(note, allNotes) : [];
  const noteFolder = note.folderId ? allFolders.find((f) => f.id === note.folderId) : undefined;

  const moveMenuMarkup = `<div class="note-action-popover folder-move-popover" role="menu"><div class="folder-popover-header">${s.moveToFolder}</div><button type="button" role="menuitem" class="folder-move-item ${!note.folderId ? "is-active" : ""}" data-move-note="${note.id}" data-target-folder=""><span>${s.folderUnfiled}</span>${!note.folderId ? svg(icons.check, "folder-check-svg") : ""}</button>${allFolders.map((f) => `<button type="button" role="menuitem" class="folder-move-item ${note.folderId === f.id ? "is-active" : ""}" data-move-note="${note.id}" data-target-folder="${f.id}"><span>${escapeHtml(f.name)}</span>${note.folderId === f.id ? svg(icons.check, "folder-check-svg") : ""}</button>`).join("")}<div class="folder-picker-sep" role="separator"></div><button type="button" role="menuitem" class="folder-move-item folder-move-new" data-action="create-folder" data-assign-note="${note.id}"><span style="display:flex;align-items:center;gap:0.4rem;">${svg(icons.folderPlus, "action-icon-svg")} ${s.createFolder}…</span></button></div>`;

  const folderBadge = noteFolder ? `<details class="note-folder-badge-dropdown" data-note-folder-dropdown="${note.id}"><summary class="note-folder-badge" aria-label="${escapeHtml(noteFolder.name)} · ${s.moveToFolder}" title="${escapeHtml(noteFolder.name)} · ${s.moveToFolder}">${svg(icons.folder, "note-folder-badge-svg")}<span class="note-folder-badge-name">${escapeHtml(noteFolder.name)}</span></summary>${moveMenuMarkup}</details>` : "";

  const unfiledMoveControl = !noteFolder ? `<details class="note-action-menu note-move-menu" data-note-move="${note.id}"><summary class="note-quick-action-btn move-btn" aria-label="${s.moveToFolder}" title="${s.moveToFolder}">${svg(icons.folder, "action-icon-svg")}</summary>${moveMenuMarkup}</details>` : "";

  const rawLines = note.content.split("\n");
  const lineCount = rawLines.length;
  const isLongNote = lineCount > 6 || note.content.length > 280;
  const clampedFooter = isLongNote
    ? `<div class="note-expand-footer"><button type="button" class="note-expand-drawer-btn" data-open-drawer="${note.id}" aria-label="${s.openInDrawer}" title="${s.openInDrawer}"><span>${s.openInDrawer}</span>${svg(icons.externalLink, "expand-btn-svg")}</button></div>`
    : "";

  return `<div class="note-list-item"><article class="note" id="note-${note.id}" data-note-id="${note.id}"><header class="note-header"><div class="note-header-left"><time datetime="${note.createdAt}" class="note-time-text">${formatTime(note.createdAt, note.noteDate)}</time>${folderBadge}</div><div class="note-header-actions">${unfiledMoveControl}<button type="button" class="note-quick-action-btn copy-btn" data-copy-note="${note.id}" aria-label="${s.copyNote}" title="${s.copyNote}">${svg(icons.copy, "action-icon-svg")}</button><button type="button" class="note-quick-action-btn edit-btn" data-edit-note="${note.id}" aria-label="${s.editNote}" title="${s.editNote}">${svg(icons.edit, "action-icon-svg")}</button><button type="button" class="note-quick-action-btn delete-btn" data-delete-note="${note.id}" aria-label="${s.deleteNote}" title="${s.deleteNote}">${svg(icons.trash, "action-icon-svg")}</button></div></header><div class="note-prose-container ${isLongNote ? "is-clampable" : ""}"><div class="prose">${renderMarkdown(note.content, true)}</div>${clampedFooter}</div>${backlinks.length ? `<div class="note-backlinks"><div class="note-backlinks-header">${svg(icons.link, "backlink-icon-svg")}<span>${backlinks.length} ${backlinks.length === 1 ? s.backlinkSingle : s.backlinkPlural}</span></div><ul class="note-backlinks-list">${backlinks.map((bl) => `<li class="note-backlink-item"><a href="${appUrl(`/?date=${bl.sourceNote.noteDate}#note-${bl.sourceNote.id}`)}" data-link class="backlink-date-badge" title="${s.openCalendar}">${formatShortDate(bl.sourceNote.noteDate)}</a><span class="backlink-snippet-rendered prose">${renderInlineMarkdown(bl.snippet)}</span></li>`).join("")}</ul></div>` : ""}${note.tags.length ? `<div class="note-tags">${note.tags.map((tag) => `<a href="/?date=${selectedDate}&tag=${encodeURIComponent(tag)}" data-link class="tag-pill">#${escapeHtml(tag)}</a>`).join("")}</div>` : ""}</article></div>`;
}

export function renderCalendar(host: HTMLElement, monthDate: Date, selectedDate: string, allNotes: Note[]): void {
  const s = currentStrings();
  const counts = new Map<string, number>();
  allNotes.forEach((note) => counts.set(note.noteDate, (counts.get(note.noteDate) ?? 0) + 1));
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const monthLabel = formatMonthYear(first);
  const rows: string[] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: string[] = [];
    let weekCount = 0;
    for (let day = 0; day < 7; day += 1) {
      const val = new Date(year, month, week * 7 + day - offset + 1);
      const key = isoDate(val);
      const count = counts.get(key) ?? 0;
      weekCount += count;
      days.push(
        `<a href="/?date=${key}" data-link class="calendar-day ${val.getMonth() === month ? "" : "is-outside"} ${key === selectedDate ? "is-selected" : ""} ${count ? "has-notes" : ""}" aria-label="${formatDateHeading(key)}${count ? `, ${count} ${count === 1 ? s.entrySingle : s.entryPlural}` : ""}" ${key === selectedDate ? 'aria-current="date"' : ""}><span>${val.getDate()}</span>${count ? `<i aria-hidden="true"></i>` : ""}</a>`
      );
    }
    const weekDate = new Date(year, month, week * 7 - offset + 1);
    rows.push(
      `<div class="calendar-week ${weekCount ? "has-notes" : ""}"><span class="calendar-week-number" title="${s.weekLabel(isoWeek(weekDate))}">${isoWeek(weekDate)}</span>${days.join("")}<span class="calendar-week-activity" aria-label="${weekCount} ${s.notesTitle.toLowerCase()}">${weekCount || ""}</span></div>`
    );
  }
  const previousMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const weekDays = getLocaleDefinition().dayInitials ?? ["M", "T", "W", "T", "F", "S", "S"];
  host.innerHTML = `<div class="calendar-popover-head"><button type="button" data-calendar-month="${isoDate(previousMonth)}" aria-label="${s.previousDay}">‹</button><strong>${monthLabel}</strong><button type="button" data-calendar-month="${isoDate(nextMonth)}" aria-label="${s.nextDay}">›</button></div><div class="calendar-weekdays"><span>Wk</span>${weekDays.map((day) => `<span>${day}</span>`).join("")}<span></span></div><div class="calendar-weeks">${rows.join("")}</div><div class="calendar-legend"><span><i></i> ${s.dayHasNotes}</span><span>${s.weeklyTotalsRight}</span></div>`;
  host.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      renderCalendar(host, new Date(`${button.dataset.calendarMonth}T12:00:00`), selectedDate, allNotes);
    })
  );
}

export async function refreshCalendar(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#sidebar-calendar");
  if (!host) return;
  const s = currentStrings();
  const allNotes = await notes.listAll();
  const counts = new Map<string, number>();
  allNotes.forEach((note) => counts.set(note.noteDate, (counts.get(note.noteDate) ?? 0) + 1));
  const now = new Date();
  const month = formatMonthYear(now);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const cells: string[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), index - startOffset + 1);
    const key = isoDate(date);
    const count = counts.get(key) ?? 0;
    const level = count === 0 ? "empty" : count < 2 ? "fill-low" : count < 4 ? "fill-medium" : "fill-high";
    const noteText = count ? `${count} ${count === 1 ? s.entrySingle : s.entryPlural}` : s.noNotesOnDay;
    cells.push(
      `<a href="/?date=${key}" data-link class="cal-cell ${date.getMonth() === now.getMonth() ? level : "out-of-month"}" title="${noteText} on ${key}">${date.getDate()}</a>`
    );
  }
  const weeks = Array.from(
    { length: 6 },
    (_, index) =>
      `<div class="calendar-week-row"><span class="cal-week-label">W${isoWeek(new Date(now.getFullYear(), now.getMonth(), index * 7 - startOffset + 1))}</span>${cells.slice(index * 7, index * 7 + 7).join("")}</div>`
  ).join("");
  const dayInitials = getLocale() === "tr" ? ["p", "s", "ç", "p", "c", "c", "p"] : ["m", "t", "w", "t", "f", "s", "s"];
  host.innerHTML = `<div class="sidebar-calendar"><div class="calendar-header"><span class="calendar-title">${month}</span></div><div class="calendar-grid"><div class="calendar-days-row"><span class="cal-day-header empty-cell">wk</span>${dayInitials.map((day) => `<span class="cal-day-header">${day}</span>`).join("")}</div>${weeks}</div></div>`;
}

setCalendarRefresher(refreshCalendar);

let activeSplitNoteId: string | null = null;

export function getActiveSplitNoteId(): string | null {
  return activeSplitNoteId;
}

export function setActiveSplitNoteId(id: string | null): void {
  activeSplitNoteId = id;
}

export function renderSplitPanel(
  note: Note | null,
  draftContent: string,
  targetFolderId: string | null,
  allFolders: Folder[],
  _date: string,
  heading: string
): string {
  const s = currentStrings();
  if (note) {
    const formattedDate = formatDateHeading(note.noteDate);
    const timeStr = formatTime(note.createdAt, note.noteDate);
    return `<header class="notes-split-panel-header" id="notes-split-header"><div class="notes-split-panel-kicker"><span class="notes-split-kicker-dot" aria-hidden="true"></span><h2 class="notes-split-panel-title" id="split-editor-heading">${s.editNoteTitle}</h2><span class="notes-split-panel-meta" id="split-editor-submeta">${formattedDate} · ${timeStr}</span></div><div class="notes-split-panel-actions"><button type="button" class="notes-split-btn split-new-btn" id="split-new-note-btn" data-split-action="new-note" title="${s.newNote}">${svg(icons.plus, "action-icon-svg")}<span>${s.newNote}</span></button><button type="button" class="notes-split-btn split-cancel-btn" data-split-action="cancel" title="${s.cancel} (Esc)">${svg(icons.close, "action-icon-svg")}<span>${s.cancel}</span></button></div></header><div class="notes-split-panel-body" id="split-pane-editor-form-host">${editorMarkup("edit-note-form", note.content, s.saveChanges, true, note.folderId, allFolders)}</div>`;
  }
  return `<header class="notes-split-panel-header" id="notes-split-header"><div class="notes-split-panel-kicker"><span class="notes-split-kicker-dot" aria-hidden="true"></span><h2 class="notes-split-panel-title" id="split-editor-heading">${s.newNote}</h2><span class="notes-split-panel-meta" id="split-editor-submeta">${heading}</span></div><div class="notes-split-panel-actions"><button type="button" class="notes-split-btn split-new-btn" id="split-new-note-btn" data-split-action="new-note" style="display: none;" title="${s.newNote}">${svg(icons.plus, "action-icon-svg")}<span>${s.newNote}</span></button></div></header><div class="notes-split-panel-body" id="split-pane-editor-form-host">${editorMarkup("new-note-form", draftContent, s.finishNote, false, targetFolderId, allFolders, false)}</div>`;
}

export function bindSplitPanel(date: string, allNotes: Note[], _allFolders: Folder[]): void {
  const panel = document.getElementById("notes-split-panel");
  if (!panel) return;
  const s = currentStrings();

  if (activeSplitNoteId) {
    const note = allNotes.find((n) => n.id === activeSplitNoteId);
    if (!note) return;
    const form = panel.querySelector<HTMLFormElement>("#edit-note-form");
    const textarea = panel.querySelector<HTMLTextAreaElement>("#edit-note-form textarea");
    if (!form || !textarea) return;

    bindFormatting(form, textarea);
    bindEditorPreview(form);
    updateEditorWordCount(form);
    textarea.addEventListener("input", () => updateEditorWordCount(form));
    textarea.focus();
    textarea.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    attachTagAutocomplete(textarea, async () => tagCounts(await notes.listAll()));
    textarea.addEventListener("input", () => {
      const cursor = textarea.selectionStart;
      if (cursor >= 2 && textarea.value.slice(cursor - 2, cursor) === "[[") {
        textarea.setRangeText("", cursor - 2, cursor, "end");
        void showLinkPickerModal(textarea);
      }
    });

    const cancelEdit = () => {
      activeSplitNoteId = null;
      void updateSplitPanel(date);
    };

    panel.querySelectorAll<HTMLButtonElement>("[data-split-action='cancel'], [data-split-action='new-note'], [data-close-dialog]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        cancelEdit();
      });
    });

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelector(".link-picker-dialog, .lite-confirm-dialog")) return;
        window.removeEventListener("keydown", onKeydown);
        cancelEdit();
      }
    };
    window.addEventListener("keydown", onKeydown);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!textarea.value.trim()) {
        showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => {
          await notes.delete(note.id);
          void track("note_deleted");
          window.removeEventListener("keydown", onKeydown);
          activeSplitNoteId = null;
          await refreshCalendar();
          await renderRoute();
        });
        return;
      }
      setBusy(form, true);
      try {
        const folderInput = form.querySelector<HTMLInputElement | HTMLSelectElement>("input[name='folderId'], select[name='folderId']");
        const folderId = folderInput ? (folderInput.value || null) : undefined;
        await notes.update(note.id, textarea.value, folderId);
        note.content = textarea.value;
        if (folderId !== undefined) note.folderId = folderId;
        setBusy(form, false);
        status(form, s.draftSaved);
        const noteEl = document.getElementById(`note-${note.id}`);
        if (noteEl) {
          const prose = noteEl.querySelector(".prose");
          if (prose) prose.innerHTML = renderMarkdown(note.content, true);
        }
        await refreshCalendar();
      } catch (error) {
        status(form, errorMessage(error), true);
        setBusy(form, false);
      }
    });
  } else {
    bindCreateEditor(date);
  }
}

export async function updateSplitPanel(date: string): Promise<void> {
  const panel = document.getElementById("notes-split-panel");
  if (!panel) return;
  const [allNotes, allFolders, draft] = await Promise.all([
    notes.listAll(),
    folders.listAll(),
    notes.getDraft(date)
  ]);
  const activeNote = activeSplitNoteId ? allNotes.find((n) => n.id === activeSplitNoteId && !n.archived) ?? null : null;
  if (!activeNote && activeSplitNoteId) {
    activeSplitNoteId = null;
  }

  // Update selected class in left stream
  document.querySelectorAll<HTMLElement>(".notes-stream-pane .note").forEach((el) => {
    const isThis = activeSplitNoteId !== null && el.dataset.noteId === activeSplitNoteId;
    el.classList.toggle("is-selected", isThis);
  });

  const heading = formatDateHeading(date);
  panel.innerHTML = renderSplitPanel(activeNote, draft?.content ?? "", null, allFolders, date, heading);
  bindSplitPanel(date, allNotes, allFolders);
}

setSplitNoteSelector((noteId, date) => {
  activeSplitNoteId = noteId;
  void updateSplitPanel(date);
});

setSplitEditorRestorer((date) => {
  activeSplitNoteId = null;
  void updateSplitPanel(date);
});

export function bindCreateEditor(date: string): void {
  const s = currentStrings();
  const form = requireElement<HTMLFormElement>("#new-note-form");
  const textarea = requireElement<HTMLTextAreaElement>("#new-note-form textarea");
  bindFormatting(form, textarea);
  bindEditorPreview(form);
  resizeEditor(textarea);
  updateEditorWordCount(form);
  const updateComposer = () => {
    const hasText = Boolean(textarea.value.trim());
    const isFocused = form.contains(document.activeElement) || Boolean(form.querySelector(".editor-template-picker[open]"));
    const isPreview = form.classList.contains("is-preview");
    form.classList.toggle("has-content", hasText || textarea.value.includes("\n") || isFocused || isPreview);
    const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = !hasText;
    }
  };
  form.querySelector(".editor-template-picker")?.addEventListener("toggle", () => {
    updateComposer();
  });
  const cancelBtn = form.querySelector<HTMLButtonElement>("[data-cancel-editor]");
  cancelBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    textarea.value = "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    setEditorMode(form, "write", false);
    form.classList.remove("has-content");
    updateComposer();
  });
  updateComposer();
  const saveDraft = () => {
    window.clearTimeout(draftTimer);
    status(form, s.savingDraft);
    draftTimer = window.setTimeout(async () => {
      await notes.saveDraft(date, textarea.value);
      status(form, s.draftSaved);
    }, 450);
  };
  textarea.addEventListener("focus", () => {
    resizeEditor(textarea);
    updateComposer();
  });
  form.addEventListener("focusin", updateComposer);
  form.addEventListener("focusout", (event) => {
    if (event.relatedTarget && form.contains(event.relatedTarget as Node)) {
      return;
    }
    window.setTimeout(() => {
      if (form.classList.contains("is-preview") || Boolean(form.querySelector(".editor-template-picker[open]"))) {
        return;
      }
      if (!form.contains(document.activeElement)) {
        resizeEditor(textarea);
        updateComposer();
      }
    }, 45);
  });
  textarea.addEventListener("input", () => {
    resizeEditor(textarea);
    updateComposer();
    updateEditorWordCount(form);
    saveDraft();
  });
  form.addEventListener("change", saveDraft);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!textarea.value.trim()) return;
    window.clearTimeout(draftTimer);
    setBusy(form, true);
    try {
      const content = textarea.value;
      const folderInput = form.querySelector<HTMLInputElement | HTMLSelectElement>("input[name='folderId'], select[name='folderId']");
      const folderId = folderInput?.value ? folderInput.value : null;
      textarea.value = "";
      resizeEditor(textarea);
      updateComposer();
      await notes.create(content, date, folderId);
      void track("note_created");
      await renderRoute();
    } catch (error) {
      status(form, errorMessage(error), true);
      setBusy(form, false);
    }
  });
  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!textarea.value.trim()) return;
      form.requestSubmit();
    }
  });
  attachTagAutocomplete(textarea, async () => tagCounts(await notes.listAll()));
  textarea.addEventListener("input", () => {
    const cursor = textarea.selectionStart;
    if (cursor >= 2 && textarea.value.slice(cursor - 2, cursor) === "[[") {
      textarea.setRangeText("", cursor - 2, cursor, "end");
      void showLinkPickerModal(textarea);
    }
  });
}

export function bindNoteActions(): void {
  const s = currentStrings();
  document.querySelectorAll<HTMLButtonElement>("[data-move-note]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const noteId = btn.dataset.moveNote;
      const targetFolder = btn.dataset.targetFolder || null;
      if (noteId) {
        await notes.moveToFolder(noteId, targetFolder);
        await renderRoute();
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-delete-note]").forEach((button) =>
    button.addEventListener("click", () =>
      showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => {
        await notes.delete(button.dataset.deleteNote ?? "");
        void track("note_deleted");
        await refreshCalendar();
        await renderRoute();
      })
    )
  );
  document.querySelectorAll<HTMLButtonElement>("[data-action='toggle-notes-layout']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextLayout = getNotesPageLayout() === "one-column" ? "two-columns" : "one-column";
      setNotesPageLayout(nextLayout);
      void renderRoute();
    });
  });

  const quickNoteBtn = document.querySelector<HTMLButtonElement>("[data-action='open-compose-drawer']");
  quickNoteBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    const allF = await folders.listAll();
    const currentUrl = new URL(location.href);
    const curDate = currentUrl.searchParams.get("date") ?? isoDate(new Date());
    void showComposeDrawer(curDate, allF);
  });

  const onQuickKey = (event: KeyboardEvent) => {
    if ((event.key === "c" || event.key === "C") && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) {
        return;
      }
      if (document.querySelector("#edit-note-backdrop, .command-palette, #search-modal, .lite-confirm-dialog")) return;
      event.preventDefault();
      const currentUrl = new URL(location.href);
      const curDate = currentUrl.searchParams.get("date") ?? isoDate(new Date());
      void folders.listAll().then((allF) => showComposeDrawer(curDate, allF));
    }
  };
  window.addEventListener("keydown", onQuickKey);

  if (getNotesPageLayout() === "two-columns") {
    document.querySelectorAll<HTMLElement>(".notes-stream-pane .note, .notes-left-column .note").forEach((noteEl) => {
      noteEl.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, details, summary")) return;
        const noteId = noteEl.dataset.noteId ?? noteEl.id.replace(/^note-/, "");
        if (!noteId) return;
        activeSplitNoteId = noteId;
        const currentUrl = new URL(location.href);
        const curDate = currentUrl.searchParams.get("date") ?? isoDate(new Date());
        void updateSplitPanel(curDate);
      });
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-edit-note], [data-open-drawer]").forEach((button) =>
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const [allN, allF] = await Promise.all([notes.listAll(), folders.listAll()]);
      const noteId = button.dataset.editNote ?? button.dataset.openDrawer;
      const note = allN.find((item) => item.id === noteId);
      if (note) showEditDialog(note, allF);
    })
  );
  document.querySelectorAll<HTMLButtonElement>("[data-copy-note]").forEach((button) =>
    button.addEventListener("click", async () => {
      const note = (await notes.listAll()).find((item) => item.id === button.dataset.copyNote);
      if (!note) return;
      await navigator.clipboard.writeText(note.content);
      const originalTitle = button.getAttribute("title") ?? "";
      button.classList.add("is-copied");
      button.innerHTML = `${svg(icons.check, "action-icon-svg")}`;
      window.setTimeout(() => {
        button.classList.remove("is-copied");
        button.innerHTML = `${svg(icons.copy, "action-icon-svg")}`;
        button.setAttribute("title", originalTitle);
      }, 1500);
    })
  );

  document.querySelectorAll<HTMLElement>(".note").forEach((noteEl) => {
    const noteId = noteEl.id.replace("note-", "");
    noteEl.querySelectorAll<HTMLInputElement>(".interactive-task-checkbox").forEach((cb) => {
      cb.addEventListener("change", async (event) => {
        event.stopPropagation();
        const taskIndex = Number(cb.dataset.taskIndex);
        if (Number.isNaN(taskIndex)) return;
        const all = await notes.listAll();
        const note = all.find((item) => item.id === noteId);
        if (!note) return;
        const updatedContent = toggleTaskInMarkdown(note.content, taskIndex);
        await notes.update(note.id, updatedContent);
        const listItem = cb.closest("li");
        if (listItem) {
          listItem.classList.toggle("is-task-completed", cb.checked);
        }
      });
    });
  });
}

export async function renderSearch(content: HTMLElement): Promise<void> {
  const q = new URLSearchParams(location.search).get("q") ?? "";
  history.replaceState({}, "", appUrl("/"));
  await renderToday(content);
  if (activeSearchOpener) {
    void activeSearchOpener(q);
  }
}
