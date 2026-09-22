import "./app.css";
import "./lite.css";
import { clearAllData, storageCounts } from "./db";
import { createBackup, DEFAULT_OLLAMA_SETTINGS, downloadBlob, downloadJson, downloadMarkdownZip, exportToDirectory, parseBackup, restoreBackup, settingsRepository } from "./data";
import { escapeHtml, renderMarkdown } from "./markdown";
import type { Category, Note, OllamaSettings } from "./models";
import { appPath, appUrl, assetUrl, normalizeAppLinks, normalizeBase } from "./routing";
import { CategoryService, initializeLocalData, normalize, NoteService } from "./services";
import { OllamaSummaryEngine, RuleBasedSummaryEngine, summaryPeriod, SummaryService, testOllama } from "./summaries";

type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

interface NavigationItem { path: string; label: string; icon: string; divider?: boolean }

const notes = new NoteService();
const categories = new CategoryService();
const summaries = new SummaryService();
const app = requireElement<HTMLDivElement>("#app");
let draftTimer: number | undefined;

const icons = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  todo: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  summary: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  category: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34A1.7 1.7 0 0 0 14 20.93V21h-4v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
} as const;

const navItems: readonly NavigationItem[] = [
  { path: "/", label: "Notes", icon: icons.home },
  { path: "/summaries", label: "Summaries", icon: icons.summary },
  { path: "/settings", label: "Settings", icon: icons.settings, divider: true }
];

function svg(content: string, className = "nav-svg"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${content}</svg>`;
}

async function renderShell(): Promise<void> {
  document.documentElement.classList.add("sidebar-collapsed");
  app.innerHTML = `<header class="global-header"><div class="header-left"><button type="button" class="mobile-sidebar-open" data-action="toggle-sidebar" aria-label="Toggle sidebar" aria-controls="app-sidebar" aria-expanded="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div><div class="header-middle"><button type="button" class="topsearch-trigger" data-action="open-search"><span class="search-placeholder">Type / to search notes</span><kbd class="search-hotkey">⌘ K</kbd></button></div><div class="header-right"></div></header>
    <div id="search-modal" class="modal-backdrop" aria-hidden="true"><div class="modal-content search-palette" role="dialog" aria-modal="true" aria-labelledby="search-dialog-title"><div class="palette-search-bar">${svg(icons.search, "modal-search-icon")}<label id="search-dialog-title" class="visually-hidden" for="modal-search-input">Search notes</label><input type="search" id="modal-search-input" placeholder="Search notes, tags, or commands…" autocomplete="off"><span class="modal-close-hint">esc</span></div><div class="palette-filters"><select id="modal-search-tag" aria-label="Filter by tag"><option value="">All tags</option></select><select id="modal-search-period" aria-label="Filter by period"><option value="">Any time</option><option value="week">This week</option><option value="month">This month</option></select><label class="filter-todo-chip"><input id="modal-search-todo" type="checkbox"> <span>Open tasks</span></label><a href="${appUrl("/search")}" data-link class="filter-more-link">More filters &rarr;</a></div><div id="modal-search-results" class="modal-body"></div><div class="palette-footer"><div class="palette-footer-hints"><span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span><span><kbd>&crarr;</kbd> open</span><span><kbd>esc</kbd> close</span></div></div></div></div>
    <div id="dialog-host"></div><button type="button" class="scrim" data-action="close-sidebar" aria-label="Close navigation"></button>
    <div class="main-layout"><aside class="sidebar" id="app-sidebar"><div class="sidebar-brand-row"><a class="sidebar-brand" href="${appUrl("/")}" data-link aria-label="Rook Notes Lite" data-sidebar-tooltip="Rook Notes Lite"><img src="${assetUrl("/logo.png")}" alt="" width="32" height="32" class="sidebar-brand-logo"><span class="sidebar-brand-name">Rook notes</span></a><button type="button" class="sidebar-collapse-button" data-action="toggle-sidebar" aria-label="Collapse sidebar" aria-controls="app-sidebar" aria-expanded="true"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="2.25" width="12.5" height="11.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.25"/><path d="M5.5 2.75v10.5M9.75 5.5 7.5 8l2.25 2.5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sidebar-toggle-tooltip">Close sidebar</span></button></div><div class="sidebar-mobile-head"><span>Navigation</span><button type="button" class="sidebar-close" data-action="close-sidebar" aria-label="Close navigation">&times;</button></div><nav>${renderNavigation()}</nav><div class="sidebar-footer"><button type="button" class="sidebar-theme-toggle" data-action="toggle-theme" aria-label="Switch color theme" data-sidebar-tooltip="Switch to dark theme">${svg(icons.moon, "theme-dark-icon")}${svg(icons.sun, "theme-light-icon")}</button><span class="local-only-icon" role="img" tabindex="0" aria-label="Local only: stored in this browser" data-sidebar-tooltip="Local only · stored in this browser">${svg(icons.lock, "")}</span></div></aside><div class="shell"><main id="page-content" class="lite-shell-main" tabindex="-1"></main></div></div>`;
  bindShellEvents(); applyTheme(); updateSidebarButton(); await renderRoute();
}

function renderNavigation(): string {
  return navItems.map((item) => `${item.divider ? '<div class="sidebar-nav-divider"></div>' : ""}<a href="${appUrl(item.path)}" data-link data-path="${item.path}" data-sidebar-tooltip="${item.label}">${svg(item.icon)}<span class="nav-label">${item.label}</span></a>`).join("");
}

async function refreshCalendar(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#sidebar-calendar"); if (!host) return;
  const allNotes = await notes.listAll(); const counts = new Map<string, number>();
  allNotes.forEach((note) => counts.set(note.noteDate, (counts.get(note.noteDate) ?? 0) + 1));
  const now = new Date(); const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(now);
  const first = new Date(now.getFullYear(), now.getMonth(), 1); const startOffset = (first.getDay() + 6) % 7; const cells: string[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), index - startOffset + 1); const key = isoDate(date); const count = counts.get(key) ?? 0;
    const level = count === 0 ? "empty" : count < 2 ? "fill-low" : count < 4 ? "fill-medium" : "fill-high";
    cells.push(`<a href="/?date=${key}" data-link class="cal-cell ${date.getMonth() === now.getMonth() ? level : "out-of-month"}" title="${count ? `${count} notes` : "no notes"} on ${key}">${date.getDate()}</a>`);
  }
  const weeks = Array.from({ length: 6 }, (_, index) => `<div class="calendar-week-row"><span class="cal-week-label">W${isoWeek(new Date(now.getFullYear(), now.getMonth(), index * 7 - startOffset + 1))}</span>${cells.slice(index * 7, index * 7 + 7).join("")}</div>`).join("");
  host.innerHTML = `<div class="sidebar-calendar"><div class="calendar-header"><span class="calendar-title">${month}</span></div><div class="calendar-grid"><div class="calendar-days-row"><span class="cal-day-header empty-cell">wk</span>${["m", "t", "w", "t", "f", "s", "s"].map((day) => `<span class="cal-day-header">${day}</span>`).join("")}</div>${weeks}</div></div>`;
}

async function renderRoute(): Promise<void> {
  const content = requireElement<HTMLElement>("#page-content"); const path = appPath();
  document.querySelectorAll<HTMLElement>("[data-path]").forEach((link) => link.classList.toggle("is-active", link.dataset.path === "/" ? path === "/" : path.startsWith(link.dataset.path ?? "")));
  try {
    if (path === "/") await renderToday(content); else if (path === "/search") await renderSearch(content); else if (path === "/categories") await renderCategories(content);
    else if (path === "/summaries") await renderSummariesV2(content); else if (path === "/todos") await renderTodos(content); else if (path === "/data") await renderData(content); else if (path === "/settings") await renderSettings(content); else renderNotFound(content);
  } catch (error) { content.innerHTML = `<p class="notice error">${escapeHtml(errorMessage(error))}</p>`; }
  normalizeAppLinks(); document.body.classList.remove("sidebar-drawer-open"); content.focus({ preventScroll: true }); highlightLinkedNote();
}

function highlightLinkedNote(): void {
  if (!location.hash.startsWith("#note-")) return;
  const note = document.querySelector<HTMLElement>(location.hash); if (!note) return;
  note.classList.remove("is-search-target");
  requestAnimationFrame(() => requestAnimationFrame(() => { note.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); note.classList.add("is-search-target"); window.setTimeout(() => note.classList.remove("is-search-target"), 1800); }));
}

async function renderToday(content: HTMLElement): Promise<void> {
  const requested = new URLSearchParams(location.search).get("date"); const date = validIsoDate(requested) ? requested as string : isoDate(new Date());
  const value = new Date(`${date}T12:00:00`); const allCategories = await categories.list(); const allNotes = await notes.listAll(); const dayNotes = await notes.listByDate(date); const draft = await notes.getDraft(date);
  const heading = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value); const previous = shiftDate(date, -1); const next = shiftDate(date, 1); const selectedTag = new URLSearchParams(location.search).get("tag") ?? ""; const visibleNotes = selectedTag ? dayNotes.filter((note) => note.tags.includes(selectedTag)) : dayNotes; const frequentTags = tagCounts(dayNotes).slice(0, 6); document.title = `${heading} · Rook Lite`;
  content.innerHTML = `<header class="notes-day-header"><div class="date-navigation"><a href="/?date=${previous}" data-link aria-label="Previous day">‹</a><h1>${heading}</h1><a href="/?date=${next}" data-link aria-label="Next day">›</a><details class="date-picker"><summary aria-label="Open calendar">${svg(icons.calendar, "")}</summary><div class="date-picker-popover" id="notes-calendar"></div></details></div><p>Record something worth remembering.</p></header><div class="copilot-input-container">${editorMarkup("new-note-form", draft?.content ?? "", draft?.categoryIds ?? [], allCategories, "Finish note")}</div><section class="day-notes notes-panel" aria-labelledby="day-notes-title"><div class="section-head"><div class="notes-panel-heading"><h2 id="day-notes-title">Notes</h2><span>${visibleNotes.length} ${visibleNotes.length === 1 ? "entry" : "entries"}</span></div>${frequentTags.length ? `<nav class="tag-filters" aria-label="Filter notes by tag"><a href="/?date=${date}" data-link class="${selectedTag ? "" : "is-active"}" ${selectedTag ? "" : 'aria-current="page"'}>All</a>${frequentTags.map(([tag]) => `<a href="/?date=${date}&tag=${encodeURIComponent(tag)}" data-link class="${selectedTag === tag ? "is-active" : ""}" ${selectedTag === tag ? 'aria-current="page"' : ""}>#${escapeHtml(tag)}</a>`).join("")}</nav>` : ""}</div>${visibleNotes.length ? `<div class="notes-list">${visibleNotes.map((note) => noteMarkup(note, allCategories, date)).join("")}</div>` : `<div class="empty-notes"><img src="/logo.png" alt="" width="56" height="56" class="empty-notes-illustration" aria-hidden="true"><p>${selectedTag ? `No #${escapeHtml(selectedTag)} notes today` : "No notes today"}</p><span>Write something above when there’s something worth remembering.</span></div>`}</section>`;
  renderCalendar(requireElement("#notes-calendar"), value, date, allNotes);
  bindCreateEditor(date); bindNoteActions(allCategories);
}

function editorMarkup(id: string, value: string, selected: string[], allCategories: Category[], label: string): string {
  const active = allCategories.filter((category) => !category.archived);
  return `<form class="editor-card" id="${id}"><div class="simple-editor-toolbar" aria-label="Markdown formatting"><button type="button" data-format="bold" aria-label="Bold"><strong>B</strong></button><button type="button" data-format="italic" aria-label="Italic"><em>I</em></button><button type="button" data-format="list" aria-label="Bullet list">• ≡</button><button type="button" data-format="task" aria-label="Checklist">✓ ≡</button><button type="button" data-format="code" aria-label="Code">&lt;&gt;</button></div><textarea id="${id}-body" name="bodyMarkdown" rows="1" required aria-label="Note content" placeholder="What’s worth remembering from today?" class="editor-textarea simple-editor-textarea">${escapeHtml(value)}</textarea><div class="simple-editor-footer"><details class="footer-category-picker"><summary aria-label="Add tags" title="Add tags">${svg(icons.category, "")}</summary><div class="footer-category-menu">${active.map((category) => `<label class="category-pill"><input type="checkbox" name="categoryIds" value="${category.id}" ${selected.includes(category.id) ? "checked" : ""}><span>#${escapeHtml(category.name)}</span></label>`).join("")}</div></details><span class="simple-editor-hint" data-save-status aria-live="polite">${value ? "Draft restored" : "Markdown supported · add #tags inline"}</span><button type="submit" class="save-btn-rect">${label}</button></div></form>`;
}

function noteMarkup(note: Note, allCategories: Category[], selectedDate = note.noteDate): string {
  const assigned = allCategories.filter((category) => note.categoryIds.includes(category.id));
  return `<div class="note-list-item"><article class="note" id="note-${note.id}"><header class="note-header"><time datetime="${note.createdAt}">${formatTime(note.createdAt, note.noteDate)}</time><div class="note-header-actions"><details class="note-action-menu"><summary aria-label="Actions for ${escapeHtml(note.title ?? "note")}"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.15" fill="currentColor"/><circle cx="8" cy="8" r="1.15" fill="currentColor"/><circle cx="13" cy="8" r="1.15" fill="currentColor"/></svg></summary><div class="note-action-popover"><button type="button" data-edit-note="${note.id}">Edit note</button><div class="note-action-divider"></div><button type="button" class="delete-note-action" data-delete-note="${note.id}">Delete note</button></div></details></div></header><div class="prose">${renderMarkdown(note.content)}</div>${assigned.length || note.tags.length ? `<div class="note-tags">${assigned.map((category) => `<span class="tag-pill">${escapeHtml(category.name)}</span>`).join("")}${note.tags.map((tag) => `<a href="/?date=${selectedDate}&tag=${encodeURIComponent(tag)}" data-link class="tag-pill">#${escapeHtml(tag)}</a>`).join("")}</div>` : ""}</article></div>`;
}

function renderCalendar(host: HTMLElement, monthDate: Date, selectedDate: string, allNotes: Note[]): void {
  const counts = new Map<string, number>(); allNotes.forEach((note) => counts.set(note.noteDate, (counts.get(note.noteDate) ?? 0) + 1));
  const year = monthDate.getFullYear(); const month = monthDate.getMonth(); const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7; const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(first); const rows: string[] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: string[] = []; let weekCount = 0;
    for (let day = 0; day < 7; day += 1) { const value = new Date(year, month, week * 7 + day - offset + 1); const key = isoDate(value); const count = counts.get(key) ?? 0; weekCount += count; days.push(`<a href="/?date=${key}" data-link class="calendar-day ${value.getMonth() === month ? "" : "is-outside"} ${key === selectedDate ? "is-selected" : ""} ${count ? "has-notes" : ""}" aria-label="${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(value)}${count ? `, ${count} ${count === 1 ? "note" : "notes"}` : ""}" ${key === selectedDate ? 'aria-current="date"' : ""}><span>${value.getDate()}</span>${count ? `<i aria-hidden="true"></i>` : ""}</a>`); }
    const weekDate = new Date(year, month, week * 7 - offset + 1); rows.push(`<div class="calendar-week ${weekCount ? "has-notes" : ""}"><span class="calendar-week-number" title="Week ${isoWeek(weekDate)}">${isoWeek(weekDate)}</span>${days.join("")}<span class="calendar-week-activity" aria-label="${weekCount} notes in this week">${weekCount || ""}</span></div>`);
  }
  const previousMonth = new Date(year, month - 1, 1); const nextMonth = new Date(year, month + 1, 1); host.innerHTML = `<div class="calendar-popover-head"><button type="button" data-calendar-month="${isoDate(previousMonth)}" aria-label="Previous month">‹</button><strong>${monthLabel}</strong><button type="button" data-calendar-month="${isoDate(nextMonth)}" aria-label="Next month">›</button></div><div class="calendar-weekdays"><span>Wk</span>${["M", "T", "W", "T", "F", "S", "S"].map((day) => `<span>${day}</span>`).join("")}<span></span></div><div class="calendar-weeks">${rows.join("")}</div><div class="calendar-legend"><span><i></i> Day has notes</span><span>Weekly totals on right</span></div>`;
  host.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) => button.addEventListener("click", () => renderCalendar(host, new Date(`${button.dataset.calendarMonth}T12:00:00`), selectedDate, allNotes)));
}

function bindCreateEditor(date: string): void {
  const form = requireElement<HTMLFormElement>("#new-note-form"); const textarea = requireElement<HTMLTextAreaElement>("#new-note-form textarea"); bindFormatting(form, textarea); resizeEditor(textarea);
  const updateComposer = () => form.classList.toggle("has-content", Boolean(textarea.value.trim())); updateComposer();
  const saveDraft = () => { window.clearTimeout(draftTimer); status(form, "Saving…"); draftTimer = window.setTimeout(async () => { await notes.saveDraft(date, textarea.value, selectedCategories(form)); status(form, "Saved locally ✓"); }, 450); };
  textarea.addEventListener("input", () => { resizeEditor(textarea); updateComposer(); saveDraft(); }); form.addEventListener("change", saveDraft);
  form.addEventListener("submit", async (event) => { event.preventDefault(); if (!textarea.value.trim()) return; window.clearTimeout(draftTimer); setBusy(form, true); try { const content = textarea.value; const categoryIds = selectedCategories(form); textarea.value = ""; updateComposer(); await notes.create(content, date, categoryIds); await renderRoute(); } catch (error) { status(form, errorMessage(error), true); setBusy(form, false); } });
  textarea.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); form.requestSubmit(); } });
}

function bindNoteActions(allCategories: Category[]): void {
  document.querySelectorAll<HTMLButtonElement>("[data-delete-note]").forEach((button) => button.addEventListener("click", () => showConfirm("Delete note?", "This note will be permanently removed from this browser.", "Delete note", async () => { await notes.delete(button.dataset.deleteNote ?? ""); await refreshCalendar(); await renderRoute(); })));
  document.querySelectorAll<HTMLButtonElement>("[data-edit-note]").forEach((button) => button.addEventListener("click", async () => { const note = (await notes.listAll()).find((item) => item.id === button.dataset.editNote); if (note) showEditDialog(note, allCategories); }));
}

function showEditDialog(note: Note, allCategories: Category[]): void {
  const host = requireElement<HTMLElement>("#dialog-host"); host.innerHTML = `<div class="note-edit-backdrop"><section class="note-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="note-edit-title"><header class="note-edit-dialog-head"><div><h2 id="note-edit-title">Edit note</h2><p>${note.noteDate}</p></div><button type="button" class="note-edit-close" data-close-dialog aria-label="Close editor">&times;</button></header><div class="note-modal-form">${editorMarkup("edit-note-form", note.content, note.categoryIds, allCategories, "Save changes")}</div></section></div>`;
  document.body.style.overflow = "hidden"; const form = requireElement<HTMLFormElement>("#edit-note-form"); const textarea = requireElement<HTMLTextAreaElement>("#edit-note-form textarea"); bindFormatting(form, textarea); resizeEditor(textarea); textarea.focus();
  form.addEventListener("submit", async (event) => { event.preventDefault(); setBusy(form, true); try { await notes.update(note.id, textarea.value, selectedCategories(form)); closeDialog(); await renderRoute(); } catch (error) { status(form, errorMessage(error), true); setBusy(form, false); } });
}

async function renderCategories(content: HTMLElement): Promise<void> {
  const all = await categories.list(); const active = all.filter((category) => !category.archived); const archived = all.filter((category) => category.archived); document.title = "Categories · Rook Lite";
  content.innerHTML = `<div class="page-head categories-page-head"><div><h1>Categories</h1><p class="lede">Organize notes by the areas of work you want to revisit later.</p></div><details class="category-create"><summary class="category-create-trigger">New category</summary><div class="category-create-panel"><form id="category-create-form" class="category-create-form"><div class="category-form-heading"><h2>Create category</h2><p>Use a short, reusable name such as Mentorship or Delivery.</p></div><label for="new-category-name">Name</label><input id="new-category-name" name="name" placeholder="Category name" required><p class="hint" data-category-error></p><button type="submit">Create category</button></form></div></details></div><section class="category-section"><div class="category-section-head"><div><h2>Active</h2><p>Available when writing or editing a note.</p></div><span class="category-count">${active.length}</span></div>${active.length ? `<div class="category-list">${active.map(categoryRow).join("")}</div>` : '<div class="category-empty"><p>No active categories.</p><span>Create one to start organizing your notes.</span></div>'}</section>${archived.length ? `<details class="archived-categories"><summary><span>Archived</span><span class="category-count">${archived.length}</span></summary><p>Hidden from the editor but retained on existing notes.</p><ul>${archived.map((category) => `<li><span class="category-marker"></span><span>${escapeHtml(category.name)}</span><code>${escapeHtml(category.slug)}</code><button type="button" class="linklike delete-note-action" data-delete-category="${category.id}">Delete</button></li>`).join("")}</ul></details>` : ""}`;
  const create = requireElement<HTMLFormElement>("#category-create-form"); create.addEventListener("submit", async (event) => { event.preventDefault(); try { await categories.create(new FormData(create).get("name")?.toString() ?? ""); await renderRoute(); } catch (error) { const field = create.querySelector<HTMLElement>("[data-category-error]"); if (field) field.textContent = errorMessage(error); } }); bindCategoryActions();
}

function categoryRow(category: Category): string {
  return `<div class="category-item"><input type="checkbox" id="edit-${category.id}" class="edit-row-toggle" hidden><div class="category-summary"><span class="category-marker"></span><div class="category-copy"><strong>${escapeHtml(category.name)}</strong><span><code>${escapeHtml(category.slug)}</code></span></div><label for="edit-${category.id}" class="category-edit-trigger">Edit</label></div><div class="category-editor"><form class="category-rename-form" data-rename-category="${category.id}"><div class="category-edit-field"><label for="name-${category.id}">Category name</label><input id="name-${category.id}" name="name" value="${escapeHtml(category.name)}" required></div><div class="category-edit-actions"><label for="edit-${category.id}" class="category-cancel">Cancel</label><button type="submit">Save changes</button></div></form><div class="category-archive-form"><button type="button" data-archive-category="${category.id}">Archive category</button><button type="button" class="delete-note-action" data-delete-category="${category.id}">Delete category</button></div></div></div>`;
}

function bindCategoryActions(): void {
  document.querySelectorAll<HTMLFormElement>("[data-rename-category]").forEach((form) => form.addEventListener("submit", async (event) => { event.preventDefault(); try { await categories.rename(form.dataset.renameCategory ?? "", new FormData(form).get("name")?.toString() ?? ""); await renderRoute(); } catch (error) { alert(errorMessage(error)); } }));
  document.querySelectorAll<HTMLButtonElement>("[data-archive-category]").forEach((button) => button.addEventListener("click", async () => { await categories.archive(button.dataset.archiveCategory ?? ""); await renderRoute(); }));
  document.querySelectorAll<HTMLButtonElement>("[data-delete-category]").forEach((button) => button.addEventListener("click", () => showConfirm("Delete category?", "The category will be removed from every assigned note. Notes themselves will not be deleted.", "Delete category", async () => { await categories.delete(button.dataset.deleteCategory ?? ""); await renderRoute(); })));
}

async function renderSearch(content: HTMLElement): Promise<void> {
  const allCategories = await categories.list(); const allNotes = await notes.listAll(); const tags = [...new Set(allNotes.flatMap((note) => note.tags))].sort(); const params = new URLSearchParams(location.search);
  document.title = "Search · Rook Lite"; content.innerHTML = `<div class="search-page"><header class="page-head"><div><h1>Search</h1><p class="lede">Find notes by text, date, tag, or type.</p></div></header><form id="search-form" class="search-workspace"><div class="search-query-field">${svg(icons.search, "search-field-icon")}<label class="visually-hidden" for="search-query">Search notes</label><input id="search-query" type="search" name="q" value="${escapeHtml(params.get("q") ?? "")}" placeholder="Search notes…" autocomplete="off"><kbd>/</kbd></div><div class="search-filter-grid"><label><span>From</span><input type="date" name="from" value="${escapeHtml(params.get("from") ?? "")}"></label><label><span>To</span><input type="date" name="to" value="${escapeHtml(params.get("to") ?? "")}"></label><label><span>Tag</span><select name="tag"><option value="">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}" ${params.get("tag") === tag ? "selected" : ""}>#${escapeHtml(tag)}</option>`).join("")}</select></label><label><span>Category</span><select name="category"><option value="">All categories</option>${allCategories.filter((category) => !category.archived).map((category) => `<option value="${category.id}" ${params.get("category") === category.id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select></label><label><span>Content</span><select name="content"><option value="">Everything</option><option value="todo" ${params.get("content") === "todo" ? "selected" : ""}>Open tasks</option><option value="tagged" ${params.get("content") === "tagged" ? "selected" : ""}>Tagged notes</option><option value="untagged" ${params.get("content") === "untagged" ? "selected" : ""}>Untagged notes</option></select></label><label><span>Sort</span><select name="sort"><option value="newest" ${params.get("sort") !== "oldest" ? "selected" : ""}>Newest first</option><option value="oldest" ${params.get("sort") === "oldest" ? "selected" : ""}>Oldest first</option></select></label></div><div class="search-filter-footer"><p>Filters update results immediately.</p><button type="button" class="secondary-button" id="clear-search">Clear filters</button></div></form><section class="search-results-panel" aria-labelledby="search-results-title"><header><h2 id="search-results-title">Results</h2><span id="search-result-count" aria-live="polite"></span></header><div id="results"></div></section></div>`;
  const form = requireElement<HTMLFormElement>("#search-form"); let timer: number; const update = () => { window.clearTimeout(timer); timer = window.setTimeout(async () => { const data = new FormData(form); const next = new URLSearchParams(); for (const key of ["q", "from", "to", "tag", "category", "content", "sort"]) { const value = data.get(key)?.toString(); if (value && !(key === "sort" && value === "newest")) next.set(key, value); } history.replaceState({}, "", appUrl(`/search${next.size ? `?${next}` : ""}`)); await renderSearchPageResults(requireElement("#results"), requireElement("#search-result-count"), data, allCategories); }, 150); }; form.addEventListener("input", update); form.addEventListener("change", update); requireElement("#clear-search").addEventListener("click", () => { form.reset(); history.replaceState({}, "", appUrl("/search")); void renderSearchPageResults(requireElement("#results"), requireElement("#search-result-count"), new FormData(form), allCategories); }); await renderSearchPageResults(requireElement("#results"), requireElement("#search-result-count"), new FormData(form), allCategories);
}

async function renderSearchPageResults(host: HTMLElement, countHost: HTMLElement, data: FormData, allCategories: Category[]): Promise<void> {
  const query = data.get("q")?.toString() ?? ""; const from = data.get("from")?.toString() ?? ""; const to = data.get("to")?.toString() ?? ""; const tag = data.get("tag")?.toString() ?? ""; const category = data.get("category")?.toString() ?? ""; const content = data.get("content")?.toString() ?? ""; const sort = data.get("sort")?.toString() ?? "newest"; const categoryMap = new Map(allCategories.map((item) => [item.id, item.name])); const parsed = parseSearch(query); const wanted = normalize(parsed.text.replace(/^#/, ""));
  const matching = (await notes.listAll()).filter((note) => !note.archived && (!from || note.noteDate >= from) && (!to || note.noteDate <= to) && (!tag || note.tags.includes(tag)) && (!category || note.categoryIds.includes(category)) && (!parsed.tag || note.tags.includes(parsed.tag)) && (!parsed.category || note.categoryIds.some((id) => normalize(categoryMap.get(id) ?? "") === parsed.category)) && (!(parsed.hasTodo || content === "todo") || /^\s*[-*+]\s+\[ \]\s+/m.test(note.content)) && (content !== "tagged" || note.tags.length > 0) && (content !== "untagged" || note.tags.length === 0)).filter((note) => !wanted || notes.searchableText(note, note.categoryIds.map((id) => categoryMap.get(id) ?? "")).includes(wanted)).sort((a, b) => (sort === "oldest" ? a.noteDate.localeCompare(b.noteDate) || a.createdAt.localeCompare(b.createdAt) : b.noteDate.localeCompare(a.noteDate) || b.updatedAt.localeCompare(a.updatedAt)));
  countHost.textContent = `${matching.length} ${matching.length === 1 ? "note" : "notes"}`; host.innerHTML = matching.length ? `<ol class="search-result-list">${matching.map((note) => `<li><a href="/?date=${note.noteDate}#note-${note.id}" data-link><div class="search-result-meta"><time datetime="${note.noteDate}">${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(`${note.noteDate}T12:00:00`))}</time>${note.tags.slice(0, 3).map((item) => `<span>#${escapeHtml(item)}</span>`).join("")}</div><p>${escapeHtml(note.content.replace(/[#*_`>\[\]-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240))}</p></a></li>`).join("")}</ol>` : '<div class="search-results-empty"><p>No notes found</p><span>Try removing a filter or using fewer words.</span></div>'; normalizeAppLinks(host);
}

async function renderSearchResults(host: HTMLElement, query: string, year: string, categoryId: string, allCategories: Category[], from = "", to = ""): Promise<void> {
  const categoryMap = new Map(allCategories.map((category) => [category.id, category.name])); const parsed = parseSearch(query); const wanted = normalize(parsed.text.replace(/^#/, ""));
  const matching = (await notes.listAll()).filter((note) => !note.archived && (!year || note.noteDate.startsWith(year)) && (!from || note.noteDate >= from) && (!to || note.noteDate <= to) && (!categoryId || note.categoryIds.includes(categoryId)) && (!parsed.tag || note.tags.includes(parsed.tag)) && (!parsed.category || note.categoryIds.some((id) => normalize(categoryMap.get(id) ?? "") === parsed.category)) && (!parsed.hasTodo || /^\s*[-*+]\s+\[ \]\s+/m.test(note.content))).filter((note) => !wanted || notes.searchableText(note, note.categoryIds.map((id) => categoryMap.get(id) ?? "")).includes(wanted)).sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.updatedAt.localeCompare(a.updatedAt));
  const commands = query ? "" : `<div class="search-commands"><div class="palette-section-label">Quick actions</div><a href="${appUrl("/")}" data-link data-command="new-note" class="command-item"><div class="command-item-left">${svg(icons.plus, "command-icon")}<span>New note</span></div><kbd>N</kbd></a><a href="${appUrl("/summaries")}" data-link class="command-item"><div class="command-item-left">${svg(icons.summary, "command-icon")}<span>Generate weekly summary</span></div></a><a href="${appUrl("/settings")}" data-link class="command-item"><div class="command-item-left">${svg(icons.settings, "command-icon")}<span>Export notes or open settings</span></div></a></div>`;
  host.innerHTML = !query && !year && !categoryId ? `${commands}<div class="palette-results-heading"><span>Recent notes</span><span>${matching.slice(0, 5).length}</span></div>${matching.slice(0, 5).length ? searchHits(matching.slice(0, 5)) : '<div class="palette-empty"><p>No notes yet</p><span>Create a note and it will appear here.</span></div>'}` : !matching.length ? `<div class="palette-empty"><p>No matching notes</p><span>Try fewer words or remove a filter.</span></div>` : `<div class="palette-results-heading"><span>Matching notes</span><span>${matching.length}</span></div>${searchHits(matching)}`;
  normalizeAppLinks(host);
}

function parseSearch(query: string): { text: string; tag: string; category: string; hasTodo: boolean } { let text = query; const read = (pattern: RegExp) => { const match = text.match(pattern); if (match) text = text.replace(match[0], " "); return normalize(match?.[1] ?? ""); }; const tag = read(/(?:^|\s)tag:([^\s]+)/i); const category = read(/(?:^|\s)category:([^\s]+)/i); const hasTodo = /(?:^|\s)has:todo(?:\s|$)/i.test(text); text = text.replace(/(?:^|\s)has:todo(?:\s|$)/i, " "); return { text, tag, category, hasTodo }; }
function searchHits(items: Note[]): string { return `<ol class="palette-result-list">${items.map((note) => { const preview = note.content.replace(/[#*_`>\[\]-]/g, " ").replace(/\s+/g, " ").trim() || "Untitled note"; return `<li><a href="${appUrl(`/?date=${note.noteDate}#note-${note.id}`)}" data-link class="palette-result-item"><div class="palette-result-icon">${svg(icons.note, "palette-icon")}</div><div class="palette-result-copy"><p class="palette-result-text">${escapeHtml(preview.slice(0, 180))}</p>${note.tags.length ? `<div class="palette-result-tags">${note.tags.slice(0, 3).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>` : ""}</div><time datetime="${note.noteDate}">${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${note.noteDate}T12:00:00`))}</time></a></li>`; }).join("")}</ol>`; }

async function renderTodos(content: HTMLElement): Promise<void> {
  const tasks = (await notes.listAll()).flatMap((note) => note.content.split(/\r?\n/).map((line, lineIndex) => ({ note, line, lineIndex })).filter(({ line }) => /^\s*[-*+]\s+\[ \]\s+/.test(line)));
  document.title = "To do · Rook Lite"; content.innerHTML = `<div class="page-head"><div><h1>To do</h1><p class="lede">Open tasks found in your Markdown notes.</p></div></div>${tasks.length ? `<ul class="todo-list">${tasks.map(({ note, line, lineIndex }) => `<li class="todo-item"><label class="lite-task-check"><input type="checkbox" data-task-note="${note.id}" data-task-line="${lineIndex}"><span>${escapeHtml(line.replace(/^\s*[-*+]\s+\[ \]\s+/, ""))}</span></label><a href="/?date=${note.noteDate}#note-${note.id}" data-link class="muted">${note.noteDate}</a></li>`).join("")}</ul>` : '<div class="empty-notes lite-page-placeholder"><p>No open tasks.</p><span>Add a <code>- [ ]</code> item to a note and it will appear here.</span></div>'}`;
  content.querySelectorAll<HTMLInputElement>("[data-task-note]").forEach((input) => input.addEventListener("change", async () => { input.disabled = true; try { await notes.setTaskDone(input.dataset.taskNote ?? "", Number(input.dataset.taskLine), input.checked); await renderRoute(); } catch (error) { input.checked = false; input.disabled = false; alert(errorMessage(error)); } }));
}

export async function renderSummaries(content: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search); const type = (["weekly", "monthly", "yearly", "custom"].includes(params.get("type") ?? "") ? params.get("type") : "weekly") as "weekly" | "monthly" | "yearly" | "custom"; const anchor = validIsoDate(params.get("start")) ? params.get("start") as string : isoDate(new Date()); const end = validIsoDate(params.get("end")) ? params.get("end") as string : anchor;
  let period; try { period = summaryPeriod(type, anchor, end); } catch { period = summaryPeriod("weekly", isoDate(new Date())); }
  const stored = await summaries.list(); const allNotes = await notes.listAll(); const allCategories = await categories.list(); const current = stored.find((summary) => summary.id === `${period.type}:${period.start}:${period.end}`);
  document.title = "Summaries · Rook Lite";
  content.innerHTML = `<div class="page-head"><div><h1>Summaries</h1><p class="lede">Turn your local notes into an overview without sending them anywhere.</p></div></div><form id="summary-period-form" class="search-page-form lite-summary-controls"><div class="search-page-controls"><div class="search-filter"><label for="summary-type">Period</label><select id="summary-type" name="type">${["weekly", "monthly", "yearly", "custom"].map((option) => `<option value="${option}" ${option === period.type ? "selected" : ""}>${option[0].toUpperCase() + option.slice(1)}</option>`).join("")}</select></div><div class="search-filter"><label for="summary-start">${period.type === "custom" ? "Start" : "Date in period"}</label><input id="summary-start" name="start" type="date" value="${period.type === "custom" ? period.start : anchor}"></div><div class="search-filter" id="summary-end-wrap" ${period.type === "custom" ? "" : "hidden"}><label for="summary-end">End</label><input id="summary-end" name="end" type="date" value="${period.end}"></div></div><button type="submit">Show period</button></form><section id="summary-block" class="summary"><div class="summary-heading"><div><p class="summary-kicker">${period.start} to ${period.end}</p><h2>${period.type[0].toUpperCase() + period.type.slice(1)} summary</h2></div>${current ? '<span class="summary-status">Ready</span>' : ""}</div>${current ? `<p class="muted summary-meta"><span>${current.engine}</span>${current.model ? `<span> · ${escapeHtml(current.model)}</span>` : ""}${current.editedMarkdown ? '<span class="pill">edited</span>' : ""}</p><div class="prose">${renderMarkdown(current.editedMarkdown ?? current.generatedMarkdown)}</div><details class="summary-edit"><summary>Edit</summary><form id="summary-edit-form"><textarea name="text" rows="10">${escapeHtml(current.editedMarkdown ?? current.generatedMarkdown)}</textarea><p class="hint">Your edit is stored separately from regenerated text.</p><button type="submit">Save</button></form></details><button type="button" class="linklike" id="generate-summary">Write it again</button>` : '<p class="muted">No summary for this period yet. Rule-based generation works entirely offline.</p><button type="button" id="generate-summary">Write it</button>'}<p class="notice error" id="summary-error" hidden></p></section>${stored.length > (current ? 1 : 0) ? `<section class="category-section"><div class="category-section-head"><div><h2>Previous summaries</h2></div><span class="category-count">${stored.length - (current ? 1 : 0)}</span></div><div class="category-list">${stored.filter((summary) => summary.id !== current?.id).map((summary) => `<div class="category-item"><div class="category-summary"><div class="category-copy"><strong>${summary.periodStart} to ${summary.periodEnd}</strong><span>${summary.type} · ${summary.engine} · ${summary.noteCount} notes</span></div></div></div>`).join("")}</div></section>` : ""}`;
  const periodForm = requireElement<HTMLFormElement>("#summary-period-form"); requireElement<HTMLSelectElement>("#summary-type").addEventListener("change", (event) => { requireElement<HTMLElement>("#summary-end-wrap").hidden = (event.currentTarget as HTMLSelectElement).value !== "custom"; }); periodForm.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(periodForm); const next = new URLSearchParams({ type: data.get("type")?.toString() ?? "weekly", start: data.get("start")?.toString() ?? isoDate(new Date()) }); if (data.get("type") === "custom") next.set("end", data.get("end")?.toString() ?? ""); history.replaceState({}, "", appUrl(`/summaries?${next}`)); void renderRoute(); });
  requireElement<HTMLButtonElement>("#generate-summary").addEventListener("click", async (event) => { const button = event.currentTarget as HTMLButtonElement; button.disabled = true; const settings = await settingsRepository.get<OllamaSettings>("ollama") ?? DEFAULT_OLLAMA_SETTINGS; const source = allNotes.filter((note) => note.noteDate >= period.start && note.noteDate <= period.end); const engine = settings.enabled ? new OllamaSummaryEngine(settings) : new RuleBasedSummaryEngine(); try { const result = await summaries.generate(source, allCategories, period, engine); if (result.fallbackError) sessionStorage.setItem("summary-fallback", result.fallbackError); await renderRoute(); } catch (error) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = errorMessage(error); button.disabled = false; } });
  const fallback = sessionStorage.getItem("summary-fallback"); if (fallback) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = `Ollama was unavailable, so Rook used the offline summary: ${fallback}`; sessionStorage.removeItem("summary-fallback"); }
  const editForm = document.querySelector<HTMLFormElement>("#summary-edit-form"); editForm?.addEventListener("submit", async (event) => { event.preventDefault(); if (!current) return; await summaries.edit(current.id, new FormData(editForm).get("text")?.toString() ?? ""); await renderRoute(); });
}

async function renderSummariesV2(content: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search); const type = (["weekly", "monthly", "custom"].includes(params.get("type") ?? "") ? params.get("type") : "weekly") as "weekly" | "monthly" | "custom"; const anchor = validIsoDate(params.get("start")) ? params.get("start") as string : isoDate(new Date()); const end = validIsoDate(params.get("end")) ? params.get("end") as string : anchor; const mode = (["rule-based", "ollama", "raw"].includes(params.get("mode") ?? "") ? params.get("mode") : "rule-based") as "rule-based" | "ollama" | "raw";
  let period; try { period = summaryPeriod(type, anchor, end); } catch { period = summaryPeriod("weekly", isoDate(new Date())); }
  const stored = await summaries.list(); const allNotes = await notes.listAll(); const allCategories = await categories.list(); const source = allNotes.filter((note) => note.noteDate >= period.start && note.noteDate <= period.end && !note.archived); const current = stored.find((summary) => summary.id === `${period.type}:${period.start}:${period.end}`); const range = `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`; const rawMarkdown = rawNotesMarkdown(source); const shownMarkdown = mode === "raw" ? rawMarkdown : current?.editedMarkdown ?? current?.generatedMarkdown;
  document.title = "Summaries · Rook Lite";
  content.innerHTML = `<div class="summaries-page"><header class="page-head"><div><h1>Summaries</h1><p class="lede">Review a period, summarize it locally, and export clean Markdown.</p></div></header><form id="summary-period-form" class="summary-control-panel"><div class="summary-period-tabs" aria-label="Summary period">${[["weekly", "This Week"], ["monthly", "This Month"], ["custom", "Custom"]].map(([value, label]) => `<button type="button" data-summary-type="${value}" class="${type === value ? "is-active" : ""}" aria-pressed="${type === value}">${label}</button>`).join("")}</div><input type="hidden" name="type" value="${type}"><div class="summary-date-fields"><label class="summary-date-label"><span>${type === "custom" ? "Start date" : "Date in period"}</span><input name="start" type="date" value="${type === "custom" ? period.start : anchor}"></label><label class="summary-date-label summary-end-field" ${type === "custom" ? "" : "hidden"}><span>End date</span><input name="end" type="date" value="${period.end}"></label></div><fieldset class="summary-mode-picker"><legend>Summary mode</legend>${[["rule-based", "Rule based", "Offline and deterministic"], ["ollama", "Ollama", "Uses your local model"], ["raw", "Raw notes", "Chronological Markdown"]].map(([value, label, help]) => `<label><input type="radio" name="mode" value="${value}" ${mode === value ? "checked" : ""}><span><strong>${label}</strong><small>${help}</small></span></label>`).join("")}</fieldset></form><section class="summary-document" aria-labelledby="summary-document-title"><header><div><p>${source.length} ${source.length === 1 ? "note" : "notes"} · ${range}</p><h2 id="summary-document-title">${type === "weekly" ? `Week ${isoWeek(new Date(`${period.start}T12:00:00`))}` : type === "monthly" ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${period.start}T12:00:00`)) : "Custom range"}</h2></div><div class="summary-document-actions">${shownMarkdown ? '<button type="button" class="secondary-button" id="copy-summary">Copy Markdown</button><button type="button" class="secondary-button" id="export-summary">Export Markdown</button>' : ""}${mode !== "raw" ? `<button type="button" id="generate-summary">${current ? "Regenerate" : "Generate summary"}</button>` : ""}</div></header><p id="summary-error" class="notice error" hidden aria-live="polite"></p>${shownMarkdown ? `<div class="summary-prose prose">${renderMarkdown(shownMarkdown)}</div>${mode !== "raw" && current ? `<details class="summary-edit"><summary>Edit Markdown</summary><form id="summary-edit-form"><textarea name="text" rows="12">${escapeHtml(current.editedMarkdown ?? current.generatedMarkdown)}</textarea><button type="submit">Save changes</button></form></details>` : ""}` : `<div class="summary-empty"><img src="/logo.png" alt="" width="48" height="48"><h3>No summary yet</h3><p>${source.length ? "Generate a concise summary from the notes in this period." : "There are no notes in this period."}</p></div>`}</section></div>`;
  const form = requireElement<HTMLFormElement>("#summary-period-form"); form.querySelectorAll<HTMLButtonElement>("[data-summary-type]").forEach((button) => button.addEventListener("click", () => { const nextType = button.dataset.summaryType ?? "weekly"; const next = new URLSearchParams({ type: nextType, start: isoDate(new Date()), mode }); if (nextType === "custom") next.set("end", isoDate(new Date())); history.replaceState({}, "", appUrl(`/summaries?${next}`)); void renderRoute(); }));
  const navigate = () => { const data = new FormData(form); const next = new URLSearchParams({ type: data.get("type")?.toString() ?? "weekly", start: data.get("start")?.toString() ?? isoDate(new Date()), mode: data.get("mode")?.toString() ?? "rule-based" }); if (data.get("type") === "custom") next.set("end", data.get("end")?.toString() ?? ""); history.replaceState({}, "", appUrl(`/summaries?${next}`)); void renderRoute(); }; form.addEventListener("submit", (event) => { event.preventDefault(); navigate(); }); form.querySelectorAll<HTMLInputElement>('input[type="date"], input[name="mode"]').forEach((input) => input.addEventListener("change", navigate));
  document.querySelector<HTMLButtonElement>("#generate-summary")?.addEventListener("click", async (event) => { const button = event.currentTarget as HTMLButtonElement; button.disabled = true; button.textContent = "Generating…"; const settings = await settingsRepository.get<OllamaSettings>("ollama") ?? DEFAULT_OLLAMA_SETTINGS; const engine = mode === "ollama" ? new OllamaSummaryEngine(settings) : new RuleBasedSummaryEngine(); try { const result = await summaries.generate(source, allCategories, period, engine); if (result.fallbackError) sessionStorage.setItem("summary-fallback", result.fallbackError); await renderRoute(); } catch (error) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = errorMessage(error); button.disabled = false; button.textContent = "Generate summary"; } });
  const fallback = sessionStorage.getItem("summary-fallback"); if (fallback) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = `Ollama was unavailable. Rook used the offline summary instead: ${fallback}`; sessionStorage.removeItem("summary-fallback"); }
  document.querySelector<HTMLButtonElement>("#copy-summary")?.addEventListener("click", async () => { if (shownMarkdown) await navigator.clipboard.writeText(shownMarkdown); }); document.querySelector<HTMLButtonElement>("#export-summary")?.addEventListener("click", () => { if (shownMarkdown) downloadBlob(new Blob([shownMarkdown], { type: "text/markdown" }), `rook-summary-${period.start}-${period.end}.md`); });
  document.querySelector<HTMLFormElement>("#summary-edit-form")?.addEventListener("submit", async (event) => { event.preventDefault(); if (!current) return; const editForm = event.currentTarget as HTMLFormElement; await summaries.edit(current.id, new FormData(editForm).get("text")?.toString() ?? ""); await renderRoute(); });
}

function formatShortDate(date: string): string { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`)); }
function rawNotesMarkdown(items: Note[]): string { return items.length ? `${items.slice().sort((a, b) => a.noteDate.localeCompare(b.noteDate) || a.createdAt.localeCompare(b.createdAt)).map((note) => `## ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(`${note.noteDate}T12:00:00`))}\n\n${note.content.trim()}`).join("\n\n")}\n` : "# Notes\n\nNo notes were written in this period.\n"; }

async function renderData(content: HTMLElement): Promise<void> {
  const allNotes = await notes.listAll(); const allCategories = await categories.list(); const lastExport = await settingsRepository.get<string>("lastExportAt"); document.title = "Data Management · Rook Lite";
  content.innerHTML = `<div class="dashboard-welcome"><div class="welcome-left"><h1 class="welcome-title">Export and backup</h1><p class="welcome-banner-subtitle">Your notes stay in this browser unless you explicitly export them.</p></div></div><p id="data-message" class="notice" hidden></p><div class="settings-stack"><section class="data-panel panel-row"><h2 class="panel-title">Markdown export</h2><p class="panel-subtitle">Create human-readable Markdown organized by year, month, and ISO week.</p><p class="hint">${lastExport ? `Last directory export: ${escapeHtml(new Date(lastExport).toLocaleString())}` : "No directory export yet."}</p><div class="lite-panel-actions"><button id="directory-export" ${allNotes.length ? "" : "disabled"}>Choose export folder</button><button id="zip-export" ${allNotes.length ? "" : "disabled"}>Download Markdown ZIP</button></div></section><section class="data-panel panel-row"><h2 class="panel-title">Full backup</h2><p class="panel-subtitle">Create or restore a complete JSON backup.</p><div class="lite-panel-actions"><button id="create-backup">Create JSON backup</button><label class="save-btn-rect lite-file-label" for="restore-backup">Restore JSON backup</label><input class="visually-hidden" type="file" id="restore-backup" accept="application/json,.json"></div></section></div>`;
  document.querySelector<HTMLButtonElement>("#zip-export")?.addEventListener("click", () => downloadMarkdownZip(allNotes, allCategories));
  document.querySelector<HTMLButtonElement>("#directory-export")?.addEventListener("click", async () => { try { const count = await exportToDirectory(allNotes, allCategories); dataMessage(`Exported ${count} notes.`, false); } catch (error) { dataMessage(errorMessage(error), true); } });
  requireElement("#create-backup").addEventListener("click", async () => downloadJson(await createBackup()));
  requireElement<HTMLInputElement>("#restore-backup").addEventListener("change", async (event) => { const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (!file) return; try { const backup = parseBackup(await file.text()); showConfirm("Replace local data?", `Restore ${backup.notes.length} notes, ${backup.categories.length} categories, and ${backup.summaries.length} summaries? Current local data will be replaced.`, "Restore backup", async () => { await restoreBackup(backup); await refreshCalendar(); await renderRoute(); }); } catch (error) { dataMessage(errorMessage(error), true); } });
}

async function renderSettings(content: HTMLElement): Promise<void> {
  const counts = await storageCounts();
  const ollama = await settingsRepository.get<OllamaSettings>("ollama") ?? DEFAULT_OLLAMA_SETTINGS;
  const estimate = await navigator.storage?.estimate?.();
  const persisted = await navigator.storage?.persisted?.();
  const currentTheme = (localStorage.getItem("theme-preference") ?? "SYSTEM") as ThemePreference;
  document.title = "Settings · Rook Lite";

  content.innerHTML = `<div class="settings-page">
    <header class="page-head">
      <div>
        <h1>Settings</h1>
        <p class="lede">Configure appearance, local AI, storage persistence, and local data.</p>
      </div>
    </header>

    <div class="settings-cards-stack">
      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>Appearance</h2>
            <p>Choose your preferred interface theme for this device.</p>
          </div>
        </div>
        <div class="theme-selector-grid">
          ${([
            ["SYSTEM", "System", "Match device setting", icons.monitor],
            ["LIGHT", "Light", "Clean & crisp light mode", icons.sun],
            ["DARK", "Dark", "High contrast dark mode", icons.moon]
          ] as const).map(([val, label, desc, iconSvg]) => `
            <label class="theme-option-card ${currentTheme === val ? "is-selected" : ""}">
              <input type="radio" name="settings-theme" value="${val}" ${currentTheme === val ? "checked" : ""}>
              <div class="theme-card-icon">${svg(iconSvg, "")}</div>
              <div class="theme-card-info">
                <strong>${label}</strong>
                <span>${desc}</span>
              </div>
            </label>
          `).join("")}
        </div>
      </section>

      <section class="settings-card local-ai-card ${ollama.enabled ? "is-enabled" : "is-collapsed"}">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <div class="title-with-badge">
              <h2>Local AI</h2>
              <span class="ai-privacy-pill">100% Private · Local only</span>
            </div>
            <p>Summarize notes using an Ollama model running on your machine. No data is sent to external servers.</p>
          </div>
          <div class="ai-toggle-wrapper">
            <label class="toggle-switch" for="ollama-enabled-toggle">
              <input type="checkbox" id="ollama-enabled-toggle" ${ollama.enabled ? "checked" : ""}>
              <span class="toggle-slider"></span>
              <span class="visually-hidden">Enable local AI</span>
            </label>
          </div>
        </div>

        <div id="ollama-disabled-banner" class="ai-disabled-banner" ${ollama.enabled ? "hidden" : ""}>
          <div class="disabled-banner-content">
            <span class="disabled-banner-icon">${svg(icons.lock, "")}</span>
            <div>
              <strong>Local AI is turned off</strong>
              <p>Rook Lite will generate summaries using the built-in, fast and deterministic offline rule-based engine. Toggle the switch above if you want to connect to a local Ollama model.</p>
            </div>
          </div>
        </div>

        <div id="ollama-config-panel" class="ai-config-panel" ${ollama.enabled ? "" : "hidden"}>
          <form id="ollama-form" class="settings-form">
            <div class="form-row">
              <div class="form-field flex-2">
                <label for="ollama-endpoint">Ollama Endpoint URL</label>
                <input class="form-input" id="ollama-endpoint" name="endpoint" value="${escapeHtml(ollama.endpoint)}" placeholder="http://localhost:11434" required>
                <span class="field-hint">Only local endpoints allowed (localhost, 127.0.0.1, [::1]).</span>
              </div>
              <div class="form-field flex-2">
                <label for="ollama-model">Model</label>
                <div class="model-select-wrapper">
                  <select class="form-input" id="ollama-model" name="model" required>
                    <option value="${escapeHtml(ollama.model)}">${escapeHtml(ollama.model)}</option>
                  </select>
                </div>
                <span class="field-hint">Models detected from your running Ollama server.</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field flex-1">
                <div class="field-label-row">
                  <label for="ollama-temperature">Temperature (Creativity)</label>
                  <span id="temp-val-display" class="temp-badge">${Number(ollama.temperature).toFixed(2)}</span>
                </div>
                <input type="range" id="ollama-temperature" name="temperature" min="0" max="1" step="0.05" value="${ollama.temperature}" class="range-slider">
                <div class="range-labels">
                  <span>Precise (0.0)</span>
                  <span>Balanced (0.5)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>
            </div>

            <div class="ai-actions-row">
              <button type="button" id="test-ollama" class="secondary-button">Test connection & refresh models</button>
              <button type="submit" class="save-btn-rect">Save AI settings</button>
              <span id="ollama-status" class="status-badge" hidden aria-live="polite"></span>
            </div>
          </form>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>Storage & Persistence</h2>
            <p>Your notes, categories, and summaries live directly inside your browser storage.</p>
          </div>
        </div>
        <div class="storage-metrics-grid">
          <div class="storage-metric-box">
            <span class="metric-num">${counts.notes}</span>
            <span class="metric-label">Notes</span>
          </div>
          <div class="storage-metric-box">
            <span class="metric-num">${counts.categories}</span>
            <span class="metric-label">Categories</span>
          </div>
          <div class="storage-metric-box">
            <span class="metric-num">${counts.summaries}</span>
            <span class="metric-label">Summaries</span>
          </div>
          <div class="storage-metric-box">
            <span class="metric-num">${estimate?.usage ? formatBytes(estimate.usage) : "Local DB"}</span>
            <span class="metric-label">Estimated Usage</span>
          </div>
        </div>
        <div class="persistence-row">
          <div class="persistence-text">
            <strong>${persisted ? "✓ Persistent storage active" : "Standard browser storage"}</strong>
            <p>${persisted ? "Your browser is configured not to clear Rook Lite storage automatically when disk space is constrained." : "Ask the browser not to automatically clear your local notes if device storage runs low."}</p>
          </div>
          ${persisted ? "" : '<button type="button" id="request-persistence" class="secondary-button">Request persistence</button>'}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>Export & Backup Hub</h2>
            <p>Download full Markdown archives or JSON snapshots of your notes to your computer.</p>
          </div>
          <a href="${appUrl("/data")}" data-link class="secondary-button action-link-btn">Open Export Hub &rarr;</a>
        </div>
      </section>

      <section class="settings-card danger-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2 class="danger-title">Danger Zone</h2>
            <p>Permanently remove every note, category, and summary from this browser. This cannot be undone.</p>
          </div>
          <button type="button" id="delete-local-data" class="danger-save-btn">Delete all data</button>
        </div>
      </section>
    </div>
  </div>`;
  bindSettingsEvents(content, ollama);
}

function bindSettingsEvents(content: HTMLElement, ollama: OllamaSettings): void {
  content.querySelectorAll<HTMLInputElement>('input[name="settings-theme"]').forEach((input) => {
    input.addEventListener("change", () => {
      setTheme(input.value as ThemePreference);
      content.querySelectorAll(".theme-option-card").forEach((card) => {
        const isMatch = (card.querySelector("input") as HTMLInputElement)?.value === input.value;
        card.classList.toggle("is-selected", isMatch);
      });
    });
  });

  const tempSlider = content.querySelector<HTMLInputElement>("#ollama-temperature");
  const tempDisplay = content.querySelector<HTMLElement>("#temp-val-display");
  tempSlider?.addEventListener("input", () => {
    if (tempDisplay && tempSlider) tempDisplay.textContent = Number(tempSlider.value).toFixed(2);
  });

  const form = requireElement<HTMLFormElement>("#ollama-form");
  const toggle = requireElement<HTMLInputElement>("#ollama-enabled-toggle");

  const readOllama = (): OllamaSettings => {
    const data = new FormData(form);
    return {
      enabled: toggle.checked,
      endpoint: data.get("endpoint")?.toString().trim() ?? "",
      model: data.get("model")?.toString().trim() ?? "",
      temperature: Number(data.get("temperature") ?? 0.2),
      timeoutMs: 60000
    };
  };

  const loadModels = async (announce = false) => {
    try {
      const models = await testOllama(readOllama());
      const select = requireElement<HTMLSelectElement>("#ollama-model");
      const selected = select.value;
      select.innerHTML = models.length
        ? models.map((model) => `<option value="${escapeHtml(model)}" ${model === selected ? "selected" : ""}>${escapeHtml(model)}</option>`).join("")
        : `<option value="${escapeHtml(selected)}">${escapeHtml(selected)}</option>`;
      if (announce) ollamaMessage(models.length ? `Connected. Found ${models.length} local models.` : "Connected, but no models are installed.", false);
    } catch (error) {
      if (announce) ollamaMessage(errorMessage(error), true);
    }
  };

  toggle.addEventListener("change", async () => {
    const isEnabled = toggle.checked;
    const card = toggle.closest<HTMLElement>(".local-ai-card");
    const banner = requireElement<HTMLElement>("#ollama-disabled-banner");
    const panel = requireElement<HTMLElement>("#ollama-config-panel");

    card?.classList.toggle("is-enabled", isEnabled);
    card?.classList.toggle("is-collapsed", !isEnabled);
    banner.hidden = isEnabled;
    panel.hidden = !isEnabled;

    const current = readOllama();
    current.enabled = isEnabled;
    await settingsRepository.set("ollama", current);

    if (isEnabled) {
      void loadModels(false);
      ollamaMessage("Local AI enabled.", false);
    } else {
      ollamaMessage("Local AI disabled. Offline summaries active.", false);
    }
  });

  requireElement<HTMLButtonElement>("#test-ollama").addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    ollamaMessage("Testing local connection…", false);
    await loadModels(true);
    button.disabled = false;
  });

  if (ollama.enabled) {
    void loadModels(false);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const settings = readOllama();
      if (settings.enabled) await testOllama(settings);
      await settingsRepository.set("ollama", settings);
      ollamaMessage("AI settings saved successfully.", false);
    } catch (error) {
      ollamaMessage(errorMessage(error), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  const persistenceButton = document.querySelector<HTMLButtonElement>("#request-persistence");
  if (persistenceButton) {
    persistenceButton.addEventListener("click", async () => {
      const granted = await navigator.storage.persist();
      if (!granted) {
        alert("The browser did not grant persistent storage.");
        return;
      }
      await renderRoute();
    });
  }

  requireElement("#delete-local-data").addEventListener("click", () =>
    showConfirm(
      "Delete all local data?",
      "This permanently removes every note, category, and summary and cannot be undone. Create a backup first if you need one.",
      "Delete all data",
      async () => {
        await clearAllData();
        await categories.seedDefaults();
        await refreshCalendar();
        await renderRoute();
      }
    )
  );
}

function ollamaMessage(message: string, error: boolean): void { const element = requireElement<HTMLElement>("#ollama-status"); element.hidden = false; element.textContent = message; element.classList.toggle("error", error); }
function dataMessage(message: string, error: boolean): void { const element = requireElement<HTMLElement>("#data-message"); element.hidden = false; element.textContent = message; element.classList.toggle("error", error); }
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

function showConfirm(title: string, message: string, actionLabel: string, action: () => Promise<void>): void {
  const host = requireElement<HTMLElement>("#dialog-host"); host.innerHTML = `<div class="note-edit-backdrop"><section class="note-edit-dialog lite-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><header class="note-edit-dialog-head"><div><h2 id="confirm-title">${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div></header><footer class="note-edit-dialog-actions"><button type="button" class="note-modal-cancel" data-close-dialog>Cancel</button><button type="button" class="danger-save-btn" id="confirm-action">${escapeHtml(actionLabel)}</button></footer></section></div>`; document.body.style.overflow = "hidden";
  requireElement<HTMLButtonElement>("#confirm-action").addEventListener("click", async (event) => { const button = event.currentTarget as HTMLButtonElement; button.disabled = true; try { await action(); closeDialog(); } catch (error) { button.disabled = false; alert(errorMessage(error)); } });
}

function closeDialog(): void { const host = document.querySelector<HTMLElement>("#dialog-host"); if (host) host.replaceChildren(); document.body.style.overflow = ""; }
function renderNotFound(content: HTMLElement): void { document.title = "Not found · Rook Lite"; content.innerHTML = '<div class="page-head"><div><p class="eyebrow">404</p><h1>That page does not exist.</h1><p class="lede"><a href="/" data-link>Return to today\'s notes.</a></p></div></div>'; }

async function updateModalSearch(): Promise<void> {
  const query = requireElement<HTMLInputElement>("#modal-search-input").value;
  const tag = requireElement<HTMLSelectElement>("#modal-search-tag").value;
  const period = requireElement<HTMLSelectElement>("#modal-search-period").value;
  const todo = requireElement<HTMLInputElement>("#modal-search-todo").checked;
  const terms = [query, tag ? `tag:${tag}` : "", todo ? "has:todo" : ""].filter(Boolean).join(" ");
  const range = period === "week" ? summaryPeriod("weekly", isoDate(new Date())) : period === "month" ? summaryPeriod("monthly", isoDate(new Date())) : null;
  await renderSearchResults(requireElement("#modal-search-results"), terms, "", "", await categories.list(), range?.start, range?.end);
}

function bindShellEvents(): void {
  document.addEventListener("click", (event) => {
    const target = event.target as Element;
    document.querySelectorAll<HTMLDetailsElement>(".footer-category-picker[open], .date-picker[open], .note-action-menu[open]").forEach((details) => { if (!details.contains(target)) details.removeAttribute("open"); });
    const link = target.closest<HTMLAnchorElement>("a[data-link]");
    if (link && link.origin === location.origin && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      const rawHref = link.getAttribute("href");
      const targetUrl = rawHref ? appUrl(rawHref) : link.href;
      history.pushState({}, "", targetUrl);
      closeSearch();
      void renderRoute().then(() => {
        if (link.dataset.command === "new-note") {
          document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus();
        }
      });
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "toggle-sidebar") toggleSidebar();
    if (action === "close-sidebar") closeSidebar();
    if (action === "open-search") openSearch();
    if (action === "toggle-theme") setTheme(document.documentElement.dataset.theme === "dark" ? "LIGHT" : "DARK");
    if (target.closest("[data-close-dialog]")) closeDialog();
    if (target.id === "search-modal") closeSearch();
  });
  window.addEventListener("popstate", () => void renderRoute());
  window.addEventListener("resize", closeSidebar);
  document.addEventListener("keydown", handleKeyboard);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  requireElement<HTMLInputElement>("#modal-search-input").addEventListener("input", updateModalSearch);
  requireElement<HTMLSelectElement>("#modal-search-tag").addEventListener("change", updateModalSearch);
  requireElement<HTMLSelectElement>("#modal-search-period").addEventListener("change", updateModalSearch);
  requireElement<HTMLInputElement>("#modal-search-todo").addEventListener("change", updateModalSearch);
}

function bindFormatting(form: HTMLFormElement, textarea: HTMLTextAreaElement): void { form.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((button) => button.addEventListener("click", () => formatNote(textarea, button.dataset.format ?? ""))); }
function formatNote(textarea: HTMLTextAreaElement, style: string): void { const start = textarea.selectionStart; const end = textarea.selectionEnd; const selected = textarea.value.slice(start, end); const formats: Record<string, [string, string]> = { heading: ["## ", ""], bold: ["**", "**"], italic: ["_", "_"], strike: ["~~", "~~"], list: ["- ", ""], numbered: ["1. ", ""], task: ["- [ ] ", ""], code: ["```\n", "\n```"] }; const [rawPrefix, suffix] = formats[style] ?? ["", ""]; const before = textarea.value.slice(0, start); const prefix = ["heading", "list", "numbered", "task"].includes(style) && before && !before.endsWith("\n") ? `\n${rawPrefix}` : rawPrefix; textarea.setRangeText(`${prefix}${selected}${suffix}`, start, end, "end"); textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); textarea.dispatchEvent(new Event("input", { bubbles: true })); }
function resizeEditor(textarea: HTMLTextAreaElement): void { textarea.style.height = "auto"; textarea.style.height = `${textarea.scrollHeight}px`; }
function selectedCategories(form: HTMLFormElement): string[] { return [...form.querySelectorAll<HTMLInputElement>('input[name="categoryIds"]:checked')].map((input) => input.value); }
function status(form: HTMLFormElement, message: string, error = false): void { const element = form.querySelector<HTMLElement>("[data-save-status]"); if (element) { element.textContent = message; element.classList.toggle("text-danger", error); } }
function setBusy(form: HTMLFormElement, busy: boolean): void { form.querySelectorAll<HTMLButtonElement>("button").forEach((button) => { button.disabled = busy; }); }
function handleKeyboard(event: KeyboardEvent): void {
  const modal = document.querySelector<HTMLElement>("#search-modal");
  if (modal?.classList.contains("is-open")) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const items = modal.querySelectorAll<HTMLAnchorElement>("#modal-search-results a[data-link]");
      if (items.length) {
        event.preventDefault();
        const active = document.activeElement as HTMLElement | null;
        const index = Array.from(items).indexOf(active as HTMLAnchorElement);
        if (event.key === "ArrowDown") {
          const next = index >= 0 && index < items.length - 1 ? index + 1 : 0;
          items[next]?.focus();
        } else {
          const prev = index > 0 ? index - 1 : items.length - 1;
          items[prev]?.focus();
        }
      }
      return;
    }
  }
  const active = document.activeElement?.tagName;
  const editing = active === "INPUT" || active === "TEXTAREA" || active === "SELECT";
  if (event.key === "/" && !editing) { event.preventDefault(); openSearch(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
  if (event.key.toLowerCase() === "n" && !editing) {
    event.preventDefault();
    if (appPath() !== "/") {
      history.pushState({}, "", appUrl("/"));
      void renderRoute().then(() => document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus());
    } else document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus();
  }
  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !editing && appPath() === "/") {
    const date = new URLSearchParams(location.search).get("date") ?? isoDate(new Date());
    history.pushState({}, "", appUrl(`/?date=${shiftDate(date, event.key === "ArrowLeft" ? -1 : 1)}`));
    void renderRoute();
  }
  if (event.key === "Escape") {
    closeSearch();
    closeDialog();
    document.querySelector<HTMLDetailsElement>(".date-picker[open]")?.removeAttribute("open");
  }
}
function toggleSidebar(): void { if (innerWidth <= 960) document.body.classList.toggle("sidebar-drawer-open"); else document.documentElement.classList.add("sidebar-collapsed"); updateSidebarButton(); }
function closeSidebar(): void { document.body.classList.remove("sidebar-drawer-open"); updateSidebarButton(); }
function updateSidebarButton(): void { const visible = innerWidth <= 960 ? document.body.classList.contains("sidebar-drawer-open") : !document.documentElement.classList.contains("sidebar-collapsed"); document.querySelectorAll(".sidebar-collapse-button, .mobile-sidebar-open").forEach((button) => button.setAttribute("aria-expanded", String(visible))); }
function setTheme(theme: ThemePreference): void { localStorage.setItem("theme-preference", theme); applyTheme(); }
function applyTheme(): void { const theme = (localStorage.getItem("theme-preference") ?? "SYSTEM") as ThemePreference; const resolved = theme === "SYSTEM" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme.toLowerCase(); document.documentElement.dataset.theme = resolved; document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0d1117" : "#f6f8fa"); const toggle = document.querySelector<HTMLElement>(".sidebar-theme-toggle"); if (toggle) { const next = resolved === "dark" ? "light" : "dark"; toggle.setAttribute("aria-label", `Switch to ${next} theme`); toggle.dataset.sidebarTooltip = `Switch to ${next} theme`; } }
function openSearch(): void {
  const modal = requireElement<HTMLElement>("#search-modal");
  const input = requireElement<HTMLInputElement>("#modal-search-input");
  input.value = "";
  void notes.listAll().then((items) => {
    const tags = [...new Set(items.flatMap((note) => note.tags))].sort();
    requireElement<HTMLSelectElement>("#modal-search-tag").innerHTML = `<option value="">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">#${escapeHtml(tag)}</option>`).join("")}`;
  });
  void updateModalSearch();
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => input.focus(), 50);
}
function closeSearch(): void { const modal = document.querySelector<HTMLElement>("#search-modal"); if (!modal?.classList.contains("is-open")) return; modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
function updateNetworkStatus(): void { const status = document.querySelector<HTMLElement>("#network-status"); if (status) status.textContent = navigator.onLine ? "Online" : "Offline"; }
function isoDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function shiftDate(date: string, days: number): string { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return isoDate(value); }
function tagCounts(items: Note[]): Array<[string, number]> { const counts = new Map<string, number>(); items.forEach((note) => note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1))); return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function isoWeek(date: Date): number { const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7)); return Math.ceil((((value.getTime() - Date.UTC(value.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7); }
function validIsoDate(value: string | null): boolean { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())); }
function formatTime(createdAt: string, noteDate: string): string { return noteDate === isoDate(new Date()) ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(createdAt)) : noteDate; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Something went wrong."; }
function requireElement<T extends Element>(selector: string): T { const element = document.querySelector<T>(selector); if (!element) throw new Error(`Missing required element: ${selector}`); return element; }

async function start(): Promise<void> { try { await initializeLocalData(); await renderShell(); } catch (error) { app.innerHTML = `<main class="shell"><p class="notice error">Rook Lite could not open local storage: ${escapeHtml(errorMessage(error))}</p></main>`; } }

void start();
if ("serviceWorker" in navigator && import.meta.env.PROD) window.addEventListener("load", () => { void navigator.serviceWorker.register(assetUrl("sw.js"), { scope: normalizeBase().prefix }); });
