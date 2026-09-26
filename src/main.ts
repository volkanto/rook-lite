import "./app.css";
import "./lite.css";
import { clearAllData, storageCounts } from "./db";
import { createBackup, DEFAULT_OLLAMA_SETTINGS, downloadBlob, downloadJson, downloadMarkdownZip, exportToDirectory, parseBackup, restoreBackup, settingsRepository } from "./data";
import { currentStrings, formatDateHeading, formatMonthYear, formatShortDate, formatTimeLocale, getAvailableLocales, getLocale, getRelativeDateInfo, setLocale, type SupportedLocale } from "./i18n";
import { escapeHtml, renderMarkdown, toggleTaskInMarkdown } from "./markdown";
import { attachTagAutocomplete } from "./tag-autocomplete";
import type { Category, Note, OllamaSettings } from "./models";
import { appPath, appUrl, assetUrl, normalizeAppLinks, normalizeBase } from "./routing";
import { CategoryService, initializeLocalData, normalize, NoteService } from "./services";
import { DEFAULT_OLLAMA_PROMPT, OllamaSummaryEngine, RuleBasedSummaryEngine, summaryPeriod, SummaryService, testOllama } from "./summaries";

type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

interface NavigationItem { path: string; label: string; icon: string; divider?: boolean }

const notes = new NoteService();
const categories = new CategoryService();
const summaries = new SummaryService();
const app = requireElement<HTMLDivElement>("#app");
let draftTimer: number | undefined;

export const icons = {
  home: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
  note: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v18"/><path d="M13 8l2 0"/><path d="M13 12l2 0"/>',
  todo: '<path d="M3.5 5.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 11.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 17.5l1.5 1.5l2.5 -2.5"/><path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/>',
  summary: '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6"/>',
  search: '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
  category: '<path d="M3 8v4.172a2 2 0 0 0 .586 1.414l5.71 5.71a2.41 2.41 0 0 0 3.408 0l3.592 -3.592a2.41 2.41 0 0 0 0 -3.408l-5.71 -5.71a2 2 0 0 0 -1.414 -.586h-4.172a2 2 0 0 0 -2 2"/><path d="M18 19l1.592 -1.592a4.82 4.82 0 0 0 0 -6.816l-4.592 -4.592"/><path d="M7 10h-.01"/>',
  export: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M11.5 21h-4.5a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v5m-5 6h7m-3 -3l3 3l-3 3"/>',
  settings: '<path d="M12 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 6l8 0"/><path d="M16 6l4 0"/><path d="M6 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 12l2 0"/><path d="M10 12l10 0"/><path d="M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 18l11 0"/><path d="M19 18l1 0"/>',
  calendar: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M8 15h2v2h-2v-2"/>',
  lock: '<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>',
  shield: '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/><path d="M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 12l0 2.5"/>',
  sun: '<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>',
  moon: '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008"/>',
  monitor: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>',
  sidebarCollapse: '<path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12"/><path d="M9 4l0 16"/>',
  close: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  menu: '<path d="M4 6l16 0"/><path d="M4 12l16 0"/><path d="M4 18l16 0"/>',
  edit: '<path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"/><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415"/><path d="M16 5l3 3"/>',
  trash: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  more: '<path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  check: '<path d="M5 12l5 5l10 -10"/>',
  alert: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  globe: '<path d="M9 6.371c0 4.418 -2.239 6.629 -5 6.629"/><path d="M4 6.371h7"/><path d="M5 9c0 2.144 2.252 3.908 6 4"/><path d="M12 20l4 -9l4 9"/><path d="M19.1 18h-6.2"/><path d="M6.694 3l.793 .582"/>',
  github: '<path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"/>',
  chevronLeft: '<path d="M15 6l-6 6l6 6"/>',
  chevronRight: '<path d="M9 6l6 6l-6 6"/>',
  clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
  arrowUp: '<path d="M12 5l0 14"/><path d="M18 11l-6 -6"/><path d="M6 11l6 -6"/>',
  copy: '<path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/>',
  plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>'
} as const;

export const navItems: readonly NavigationItem[] = [
  { path: "/", label: "Notes", icon: icons.note },
  { path: "/summaries", label: "Summaries", icon: icons.summary },
  { path: "/settings", label: "Settings", icon: icons.settings, divider: true }
];

export function svg(content: string, className = "nav-svg"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${content}</svg>`;
}

export async function renderShell(): Promise<void> {
  const s = currentStrings();
  document.documentElement.classList.add("sidebar-collapsed");
  document.documentElement.lang = getLocale();
  app.innerHTML = `<header class="global-header"><div class="header-left"><button type="button" class="mobile-sidebar-open" data-action="toggle-sidebar" aria-label="${s.collapseSidebar}" aria-controls="app-sidebar" aria-expanded="true">${svg(icons.menu, "mobile-nav-svg")}</button></div><div class="header-middle"><button type="button" class="topsearch-trigger" data-action="open-search"><span class="search-placeholder">${s.searchPlaceholder}</span><kbd class="search-hotkey">⌘ K</kbd></button></div><div class="header-right"></div></header>
    <div id="search-modal" class="modal-backdrop" aria-hidden="true"><div class="modal-content search-palette" role="dialog" aria-modal="true" aria-labelledby="search-dialog-title"><div class="palette-search-bar">${svg(icons.search, "modal-search-icon")}<label id="search-dialog-title" class="visually-hidden" for="modal-search-input">${s.searchDialogTitle}</label><input type="search" id="modal-search-input" placeholder="${s.searchInputPlaceholder}" autocomplete="off"><span class="modal-close-hint">esc</span></div><div class="palette-filters"><div class="palette-select-wrap"><span class="palette-filter-icon">${svg(icons.category, "palette-icon-svg")}</span><select id="modal-search-tag" aria-label="${s.filterByTag}"><option value="">${s.searchPaletteAllTags}</option></select><span class="palette-select-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg></span></div><div class="palette-select-wrap"><span class="palette-filter-icon">${svg(icons.calendar, "palette-icon-svg")}</span><select id="modal-search-period" aria-label="${s.searchCategoryLabel}"><option value="">${s.searchPeriodAny}</option><option value="week">${s.searchPeriodWeek}</option><option value="month">${s.searchPeriodMonth}</option></select><span class="palette-select-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg></span></div><label class="filter-todo-chip"><input id="modal-search-todo" type="checkbox"> <span>${s.searchOpenTasks}</span></label><a href="${appUrl("/search")}" data-link class="filter-more-link">${s.searchMoreFilters}</a></div><div id="modal-search-results" class="modal-body"></div><div class="palette-footer"><div class="palette-footer-hints"><span><kbd>&uarr;</kbd><kbd>&darr;</kbd> ${s.searchHintNavigate}</span><span><kbd>&crarr;</kbd> ${s.searchHintOpen}</span><span><kbd>esc</kbd> ${s.searchHintClose}</span></div></div></div></div>
    <div id="dialog-host"></div><button type="button" class="scrim" data-action="close-sidebar" aria-label="${s.closeSidebar}"></button>
    <div class="main-layout"><aside class="sidebar" id="app-sidebar"><div class="sidebar-brand-row"><a class="sidebar-brand" href="${appUrl("/")}" data-link aria-label="${s.brandTooltip}" data-sidebar-tooltip="${s.brandTooltip}"><img src="${assetUrl("/logo.png")}" alt="" width="32" height="32" class="sidebar-brand-logo"><span class="sidebar-brand-name">Rook notes</span></a><button type="button" class="sidebar-collapse-button" data-action="toggle-sidebar" aria-label="${s.collapseSidebar}" aria-controls="app-sidebar" aria-expanded="true">${svg(icons.sidebarCollapse, "collapse-svg")}<span class="sidebar-toggle-tooltip">${s.collapseSidebar}</span></button></div><div class="sidebar-mobile-head"><span>${s.navNotes}</span><button type="button" class="sidebar-close" data-action="close-sidebar" aria-label="${s.closeSidebar}">${svg(icons.close, "sidebar-close-svg")}</button></div><nav>${renderNavigation()}</nav><div class="sidebar-footer"><button type="button" class="sidebar-theme-toggle" data-action="toggle-theme" aria-label="${s.themeToggleAria}" data-sidebar-tooltip="${document.documentElement.dataset.theme === "dark" ? s.themeToggleLight : s.themeToggleDark}">${svg(icons.moon, "theme-dark-icon nav-svg")}${svg(icons.sun, "theme-light-icon nav-svg")}</button><details class="sidebar-lang-picker" id="sidebar-lang-picker"><summary class="sidebar-lang-toggle" aria-label="${s.languageSelectTooltip}" data-sidebar-tooltip="${s.languageSelectTooltip}">${svg(icons.globe, "nav-svg")}</summary><div class="sidebar-lang-popover" role="menu">${getAvailableLocales().map((loc) => `<button type="button" class="lang-option-btn ${getLocale() === loc.code ? "is-active" : ""}" data-select-lang="${loc.code}"><span class="lang-option-code">${loc.code.toUpperCase()}</span><span class="lang-option-label">${escapeHtml(loc.label)}</span>${getLocale() === loc.code ? `<span class="lang-active-check">${svg(icons.check, "lang-check-svg")}</span>` : ""}</button>`).join("")}</div></details><div class="sidebar-footer-divider"></div><a href="https://github.com/volkanto/rook-lite" target="_blank" rel="noopener noreferrer" class="sidebar-github-link" aria-label="${s.githubTooltip}" data-sidebar-tooltip="${s.githubTooltip}">${svg(icons.github, "nav-svg")}</a><span class="local-only-icon" role="img" tabindex="0" aria-label="${s.localOnlyTooltip}" data-sidebar-tooltip="${s.localOnlyTooltip}">${svg(icons.shield, "nav-svg")}</span></div></aside><div class="shell"><main id="page-content" class="lite-shell-main" tabindex="-1"></main></div></div>`;
  bindShellEvents(); applyTheme(); updateSidebarButton(); await renderRoute();
}

export function renderNavigation(): string {
  const s = currentStrings();
  const items: readonly NavigationItem[] = [
    { path: "/", label: s.navNotes, icon: icons.note },
    { path: "/summaries", label: s.navSummaries, icon: icons.summary },
    { path: "/settings", label: s.navSettings, icon: icons.settings, divider: true }
  ];
  return items.map((item) => `${item.divider ? '<div class="sidebar-nav-divider"></div>' : ""}<a href="${appUrl(item.path)}" data-link data-path="${item.path}" data-sidebar-tooltip="${item.label}">${svg(item.icon)}<span class="nav-label">${item.label}</span></a>`).join("");
}

async function refreshCalendar(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#sidebar-calendar"); if (!host) return;
  const s = currentStrings();
  const allNotes = await notes.listAll(); const counts = new Map<string, number>();
  allNotes.forEach((note) => counts.set(note.noteDate, (counts.get(note.noteDate) ?? 0) + 1));
  const now = new Date(); const month = formatMonthYear(now);
  const first = new Date(now.getFullYear(), now.getMonth(), 1); const startOffset = (first.getDay() + 6) % 7; const cells: string[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), index - startOffset + 1); const key = isoDate(date); const count = counts.get(key) ?? 0;
    const level = count === 0 ? "empty" : count < 2 ? "fill-low" : count < 4 ? "fill-medium" : "fill-high";
    const noteText = count ? `${count} ${count === 1 ? s.entrySingle : s.entryPlural}` : s.noNotesOnDay;
    cells.push(`<a href="/?date=${key}" data-link class="cal-cell ${date.getMonth() === now.getMonth() ? level : "out-of-month"}" title="${noteText} on ${key}">${date.getDate()}</a>`);
  }
  const weeks = Array.from({ length: 6 }, (_, index) => `<div class="calendar-week-row"><span class="cal-week-label">W${isoWeek(new Date(now.getFullYear(), now.getMonth(), index * 7 - startOffset + 1))}</span>${cells.slice(index * 7, index * 7 + 7).join("")}</div>`).join("");
  const dayInitials = getLocale() === "tr" ? ["p", "s", "ç", "p", "c", "c", "p"] : ["m", "t", "w", "t", "f", "s", "s"];
  host.innerHTML = `<div class="sidebar-calendar"><div class="calendar-header"><span class="calendar-title">${month}</span></div><div class="calendar-grid"><div class="calendar-days-row"><span class="cal-day-header empty-cell">wk</span>${dayInitials.map((day) => `<span class="cal-day-header">${day}</span>`).join("")}</div>${weeks}</div></div>`;
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
  requestAnimationFrame(() => requestAnimationFrame(() => { note.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); note.classList.add("is-search-target"); window.setTimeout(() => note.classList.remove("is-search-target"), 3200); }));
}

export async function renderToday(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const requested = new URLSearchParams(location.search).get("date"); const today = isoDate(new Date()); const date = validIsoDate(requested) ? requested as string : today; const isToday = date === today;
  const value = new Date(`${date}T12:00:00`); const allCategories = await categories.list(); const allNotes = await notes.listAll(); const dayNotes = await notes.listByDate(date); const draft = await notes.getDraft(date);
  const heading = formatDateHeading(date); const previous = shiftDate(date, -1); const next = shiftDate(date, 1); const selectedTag = new URLSearchParams(location.search).get("tag") ?? ""; const visibleNotes = selectedTag ? dayNotes.filter((note) => note.tags.includes(selectedTag)) : dayNotes; const frequentTags = tagCounts(dayNotes).slice(0, 6); document.title = `${heading} · Rook Lite`;

  const relativeInfo = getRelativeDateInfo(date, today, getLocale());

  content.innerHTML = `<header class="notes-day-header minimal-date-header"><div class="minimal-date-bar"><div class="minimal-date-info"><h1 class="minimal-date-title">${heading}</h1><span class="minimal-date-badge ${relativeInfo.status === "today" ? "is-today" : ""}">${relativeInfo.status === "today" ? '<span class="live-pulse-dot"></span>' : ""}<span>${relativeInfo.label}</span></span><span class="minimal-week-badge" title="${s.weekLabel(isoWeek(value))}">${s.weekLabel(isoWeek(value))}</span></div><div class="minimal-date-nav" role="navigation" aria-label="Date navigation"><a href="${appUrl(`/?date=${previous}`)}" data-link class="minimal-nav-btn prev-btn date-nav-arrow" aria-label="${s.previousDay}" title="${s.previousDay}">${svg(icons.chevronLeft, "minimal-nav-svg")}</a><a href="${appUrl("/")}" data-link class="minimal-today-link date-today-btn ${isToday ? "is-active is-disabled" : ""}" ${isToday ? 'aria-disabled="true" tabindex="-1"' : `title="${s.today}"`}>${s.today}</a><a href="${appUrl(`/?date=${next}`)}" data-link class="minimal-nav-btn next-btn date-nav-arrow" aria-label="${s.nextDay}" title="${s.nextDay}">${svg(icons.chevronRight, "minimal-nav-svg")}</a><details class="date-picker minimal-picker"><summary class="minimal-calendar-btn" aria-label="${s.openCalendar}" title="${s.openCalendar}">${svg(icons.calendar, "minimal-nav-svg")}</summary><div class="date-picker-popover" id="notes-calendar"></div></details></div></div></header><div class="copilot-input-container">${editorMarkup("new-note-form", draft?.content ?? "", draft?.categoryIds ?? [], allCategories, s.finishNote)}</div><section class="day-notes notes-panel" aria-labelledby="day-notes-title"><div class="section-head"><div class="notes-panel-heading"><h2 id="day-notes-title">${s.notesTitle}</h2><span class="notes-count-badge">${visibleNotes.length} ${visibleNotes.length === 1 ? s.entrySingle : s.entryPlural}</span></div>${frequentTags.length ? `<nav class="tag-filters" aria-label="${s.filterByTag}"><a href="/?date=${date}" data-link class="${selectedTag ? "" : "is-active"}" ${selectedTag ? "" : 'aria-current="page"'}>${s.filterAll}</a>${frequentTags.map(([tag]) => `<a href="/?date=${date}&tag=${encodeURIComponent(tag)}" data-link class="${selectedTag === tag ? "is-active" : ""}" ${selectedTag === tag ? 'aria-current="page"' : ""}>#${escapeHtml(tag)}</a>`).join("")}</nav>` : ""}</div>${visibleNotes.length ? `<div class="notes-list">${visibleNotes.map((note) => noteMarkup(note, allCategories, date)).join("")}</div><footer class="notes-stream-footer is-hidden" hidden><button type="button" class="back-to-top-btn" data-action="scroll-to-top" aria-label="${s.backToTop}">${svg(icons.arrowUp, "back-to-top-icon")}<span>${s.backToTop}</span></button></footer>` : `<div class="empty-notes"><img src="${assetUrl("/empty-notes.png")}" alt="" width="140" height="140" class="empty-notes-illustration" aria-hidden="true"><p>${selectedTag ? s.noNotesForTag(selectedTag) : s.noNotesToday}</p><span>${s.emptyNotesPrompt}</span></div>`}</section>`;
  renderCalendar(requireElement("#notes-calendar"), value, date, allNotes);
  bindCreateEditor(date); bindNoteActions(allCategories);
  updateBackToTopVisibility();
  requestAnimationFrame(() => updateBackToTopVisibility());
}

function editorMarkup(id: string, value: string, selected: string[], allCategories: Category[], label: string, isModal = false): string {
  const s = currentStrings();
  const active = allCategories.filter((category) => !category.archived);
  return `<form class="editor-card ${isModal ? "editor-card-modal" : ""}" id="${id}"><div class="simple-editor-toolbar" aria-label="Markdown formatting"><button type="button" data-format="bold" aria-label="Bold"><strong>B</strong></button><button type="button" data-format="italic" aria-label="Italic"><em>I</em></button><button type="button" data-format="list" aria-label="Bullet list">• ≡</button><button type="button" data-format="task" aria-label="Checklist">✓ ≡</button><button type="button" data-format="code" aria-label="Code">&lt;&gt;</button></div><textarea id="${id}-body" name="bodyMarkdown" rows="${isModal ? 6 : 1}" required aria-label="${s.notesTitle}" placeholder="${s.composerPlaceholder}" class="editor-textarea simple-editor-textarea">${escapeHtml(value)}</textarea><div class="simple-editor-footer"><details class="footer-category-picker"><summary aria-label="${s.navCategories}" title="${s.navCategories}">${svg(icons.category, "")}</summary><div class="footer-category-menu">${active.length ? active.map((category) => `<label class="category-pill"><input type="checkbox" name="categoryIds" value="${category.id}" ${selected.includes(category.id) ? "checked" : ""}><span>#${escapeHtml(category.name)}</span></label>`).join("") : `<span class="footer-category-empty">${s.noCategoriesInPicker}</span>`}</div></details><span class="simple-editor-hint" data-save-status aria-live="polite">${isModal ? "" : (value ? s.draftRestored : s.markdownSupported)}</span><div class="editor-modal-actions">${isModal ? `<button type="button" class="btn-secondary" data-close-dialog>${s.cancel}</button>` : ""}<button type="submit" class="save-btn-rect">${label}</button></div></div></form>`;
}

function noteMarkup(note: Note, allCategories: Category[], selectedDate = note.noteDate): string {
  const s = currentStrings();
  const assigned = allCategories.filter((category) => note.categoryIds.includes(category.id));
  return `<div class="note-list-item"><article class="note" id="note-${note.id}" data-note-id="${note.id}"><header class="note-header"><div class="note-header-left"><time datetime="${note.createdAt}" class="note-time-text">${formatTime(note.createdAt, note.noteDate)}</time>${assigned.map((category) => `<span class="note-cat-badge">#${escapeHtml(category.name)}</span>`).join("")}</div><div class="note-header-actions"><button type="button" class="note-quick-action-btn copy-btn" data-copy-note="${note.id}" aria-label="${s.copyNote}" title="${s.copyNote}">${svg(icons.copy, "action-icon-svg")}</button><button type="button" class="note-quick-action-btn edit-btn" data-edit-note="${note.id}" aria-label="${s.editNote}" title="${s.editNote}">${svg(icons.edit, "action-icon-svg")}</button><button type="button" class="note-quick-action-btn delete-btn" data-delete-note="${note.id}" aria-label="${s.deleteNote}" title="${s.deleteNote}">${svg(icons.trash, "action-icon-svg")}</button></div></header><div class="prose">${renderMarkdown(note.content, true)}</div>${note.tags.length ? `<div class="note-tags">${note.tags.map((tag) => `<a href="/?date=${selectedDate}&tag=${encodeURIComponent(tag)}" data-link class="tag-pill">#${escapeHtml(tag)}</a>`).join("")}</div>` : ""}</article></div>`;
}

function renderCalendar(host: HTMLElement, monthDate: Date, selectedDate: string, allNotes: Note[]): void {
  const s = currentStrings();
  const counts = new Map<string, number>(); allNotes.forEach((note) => counts.set(note.noteDate, (counts.get(note.noteDate) ?? 0) + 1));
  const year = monthDate.getFullYear(); const month = monthDate.getMonth(); const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7; const monthLabel = formatMonthYear(first); const rows: string[] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: string[] = []; let weekCount = 0;
    for (let day = 0; day < 7; day += 1) { const value = new Date(year, month, week * 7 + day - offset + 1); const key = isoDate(value); const count = counts.get(key) ?? 0; weekCount += count; days.push(`<a href="/?date=${key}" data-link class="calendar-day ${value.getMonth() === month ? "" : "is-outside"} ${key === selectedDate ? "is-selected" : ""} ${count ? "has-notes" : ""}" aria-label="${formatDateHeading(key)}${count ? `, ${count} ${count === 1 ? s.entrySingle : s.entryPlural}` : ""}" ${key === selectedDate ? 'aria-current="date"' : ""}><span>${value.getDate()}</span>${count ? `<i aria-hidden="true"></i>` : ""}</a>`); }
    const weekDate = new Date(year, month, week * 7 - offset + 1); rows.push(`<div class="calendar-week ${weekCount ? "has-notes" : ""}"><span class="calendar-week-number" title="${s.weekLabel(isoWeek(weekDate))}">${isoWeek(weekDate)}</span>${days.join("")}<span class="calendar-week-activity" aria-label="${weekCount} ${s.notesTitle.toLowerCase()}">${weekCount || ""}</span></div>`);
  }
  const previousMonth = new Date(year, month - 1, 1); const nextMonth = new Date(year, month + 1, 1);
  const weekDays = getLocale() === "tr" ? ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] : ["M", "T", "W", "T", "F", "S", "S"];
  host.innerHTML = `<div class="calendar-popover-head"><button type="button" data-calendar-month="${isoDate(previousMonth)}" aria-label="${s.previousDay}">‹</button><strong>${monthLabel}</strong><button type="button" data-calendar-month="${isoDate(nextMonth)}" aria-label="${s.nextDay}">›</button></div><div class="calendar-weekdays"><span>Wk</span>${weekDays.map((day) => `<span>${day}</span>`).join("")}<span></span></div><div class="calendar-weeks">${rows.join("")}</div><div class="calendar-legend"><span><i></i> ${getLocale() === "tr" ? "Notu olan gün" : "Day has notes"}</span><span>${getLocale() === "tr" ? "Haftalık toplamlar sağda" : "Weekly totals on right"}</span></div>`;
  host.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) => button.addEventListener("click", () => renderCalendar(host, new Date(`${button.dataset.calendarMonth}T12:00:00`), selectedDate, allNotes)));
}

function bindCreateEditor(date: string): void {
  const s = currentStrings();
  const form = requireElement<HTMLFormElement>("#new-note-form"); const textarea = requireElement<HTMLTextAreaElement>("#new-note-form textarea"); bindFormatting(form, textarea); resizeEditor(textarea);
  const updateComposer = () => form.classList.toggle("has-content", Boolean(textarea.value.trim())); updateComposer();
  const saveDraft = () => { window.clearTimeout(draftTimer); status(form, s.savingDraft); draftTimer = window.setTimeout(async () => { await notes.saveDraft(date, textarea.value, selectedCategories(form)); status(form, s.draftSaved); }, 450); };
  textarea.addEventListener("input", () => { resizeEditor(textarea); updateComposer(); saveDraft(); }); form.addEventListener("change", saveDraft);
  form.addEventListener("submit", async (event) => { event.preventDefault(); if (!textarea.value.trim()) return; window.clearTimeout(draftTimer); setBusy(form, true); try { const content = textarea.value; const categoryIds = selectedCategories(form); textarea.value = ""; updateComposer(); await notes.create(content, date, categoryIds); await renderRoute(); } catch (error) { status(form, errorMessage(error), true); setBusy(form, false); } });
  textarea.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); form.requestSubmit(); } });
  attachTagAutocomplete(textarea, async () => tagCounts(await notes.listAll()));
}

function bindNoteActions(allCategories: Category[]): void {
  const s = currentStrings();
  document.querySelectorAll<HTMLButtonElement>("[data-delete-note]").forEach((button) => button.addEventListener("click", () => showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => { await notes.delete(button.dataset.deleteNote ?? ""); await refreshCalendar(); await renderRoute(); })));
  document.querySelectorAll<HTMLButtonElement>("[data-edit-note]").forEach((button) => button.addEventListener("click", async () => { const note = (await notes.listAll()).find((item) => item.id === button.dataset.editNote); if (note) showEditDialog(note, allCategories); }));
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
        await notes.update(note.id, updatedContent, note.categoryIds);
        const listItem = cb.closest("li");
        if (listItem) {
          listItem.classList.toggle("is-task-completed", cb.checked);
        }
      });
    });
  });
}

export function showEditDialog(note: Note, allCategories: Category[]): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const formattedDate = formatDateHeading(note.noteDate);
  host.innerHTML = `<div class="note-edit-backdrop" id="edit-note-backdrop"><section class="note-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="note-edit-title"><header class="note-edit-dialog-head"><div class="note-edit-dialog-title-group"><h2 id="note-edit-title">${s.editNoteTitle}</h2><span class="note-edit-date-badge">${formattedDate}</span></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}">${svg(icons.close, "dialog-close-svg")}</button></header><div class="note-modal-form">${editorMarkup("edit-note-form", note.content, note.categoryIds, allCategories, s.saveChanges, true)}</div></section></div>`;
  document.body.style.overflow = "hidden";
  const backdrop = requireElement<HTMLElement>("#edit-note-backdrop");
  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) closeDialog();
  });
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      window.removeEventListener("keydown", onKeydown);
      closeDialog();
    }
  };
  window.addEventListener("keydown", onKeydown);
  const form = requireElement<HTMLFormElement>("#edit-note-form");
  const textarea = requireElement<HTMLTextAreaElement>("#edit-note-form textarea");
  bindFormatting(form, textarea);
  resizeEditor(textarea);
  textarea.focus();
  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  attachTagAutocomplete(textarea, async () => tagCounts(await notes.listAll()));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(form, true);
    try {
      await notes.update(note.id, textarea.value, selectedCategories(form));
      closeDialog();
      await renderRoute();
    } catch (error) {
      status(form, errorMessage(error), true);
      setBusy(form, false);
    }
  });
}

async function renderCategories(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const all = await categories.list(); const active = all.filter((category) => !category.archived); const archived = all.filter((category) => category.archived); document.title = `${s.categoriesTitle} · Rook Lite`;
  content.innerHTML = `<div class="page-head categories-page-head"><div><h1>${s.categoriesTitle}</h1><p class="lede">${s.categoriesLede}</p></div><details class="category-create"><summary class="category-create-trigger">${s.newCategory}</summary><div class="category-create-panel"><form id="category-create-form" class="category-create-form"><div class="category-form-heading"><h2>${s.createCategoryHeading}</h2><p>${s.createCategoryHelp}</p></div><label for="new-category-name">${s.categoryNameLabel}</label><input id="new-category-name" name="name" placeholder="${s.categoryNamePlaceholder}" required><p class="hint" data-category-error></p><button type="submit">${s.createCategoryBtn}</button></form></div></details></div><section class="category-section"><div class="category-section-head"><div><h2>${s.activeCategories}</h2><p>${s.activeCategoriesHelp}</p></div><span class="category-count">${active.length}</span></div>${active.length ? `<div class="category-list">${active.map(categoryRow).join("")}</div>` : `<div class="category-empty"><p>${s.noActiveCategories}</p><span>${s.createOneToStart}</span></div>`}</section>${archived.length ? `<details class="archived-categories"><summary><span>${s.archivedCategories}</span><span class="category-count">${archived.length}</span></summary><p>${s.archivedCategoriesHelp}</p><ul>${archived.map((category) => `<li><span class="category-marker"></span><span>${escapeHtml(category.name)}</span><code>${escapeHtml(category.slug)}</code><button type="button" class="linklike delete-note-action" data-delete-category="${category.id}">${s.deleteAction}</button></li>`).join("")}</ul></details>` : ""}`;
  const create = requireElement<HTMLFormElement>("#category-create-form"); create.addEventListener("submit", async (event) => { event.preventDefault(); try { await categories.create(new FormData(create).get("name")?.toString() ?? ""); await renderRoute(); } catch (error) { const field = create.querySelector<HTMLElement>("[data-category-error]"); if (field) field.textContent = errorMessage(error); } }); bindCategoryActions();
}

function categoryRow(category: Category): string {
  const s = currentStrings();
  return `<div class="category-item"><input type="checkbox" id="edit-${category.id}" class="edit-row-toggle" hidden><div class="category-summary"><span class="category-marker"></span><div class="category-copy"><strong>${escapeHtml(category.name)}</strong><span><code>${escapeHtml(category.slug)}</code></span></div><label for="edit-${category.id}" class="category-edit-trigger">${s.editAction}</label></div><div class="category-editor"><form class="category-rename-form" data-rename-category="${category.id}"><div class="category-edit-field"><label for="name-${category.id}">${s.categoryNameLabel}</label><input id="name-${category.id}" name="name" value="${escapeHtml(category.name)}" required></div><div class="category-edit-actions"><label for="edit-${category.id}" class="category-cancel">${s.cancel}</label><button type="submit">${s.saveChanges}</button></div></form><div class="category-archive-form"><button type="button" data-archive-category="${category.id}">${s.archiveCategoryBtn}</button><button type="button" class="delete-note-action" data-delete-category="${category.id}">${s.deleteCategoryBtn}</button></div></div></div>`;
}

function bindCategoryActions(): void {
  const s = currentStrings();
  document.querySelectorAll<HTMLFormElement>("[data-rename-category]").forEach((form) => form.addEventListener("submit", async (event) => { event.preventDefault(); try { await categories.rename(form.dataset.renameCategory ?? "", new FormData(form).get("name")?.toString() ?? ""); await renderRoute(); } catch (error) { alert(errorMessage(error)); } }));
  document.querySelectorAll<HTMLButtonElement>("[data-archive-category]").forEach((button) => button.addEventListener("click", async () => { await categories.archive(button.dataset.archiveCategory ?? ""); await renderRoute(); }));
  document.querySelectorAll<HTMLButtonElement>("[data-delete-category]").forEach((button) => button.addEventListener("click", () => showConfirm(s.deleteCategoryConfirmTitle, s.categoryRemovedHelp, s.deleteCategoryBtn, async () => { await categories.delete(button.dataset.deleteCategory ?? ""); await renderRoute(); })));
}

async function renderSearch(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const allCategories = await categories.list(); const allNotes = await notes.listAll(); const tags = [...new Set(allNotes.flatMap((note) => note.tags))].sort(); const params = new URLSearchParams(location.search);
  document.title = `${s.searchTitle} · Rook Lite`; content.innerHTML = `<div class="search-page"><header class="page-head"><div><h1>${s.searchTitle}</h1><p class="lede">${s.searchLede}</p></div></header><form id="search-form" class="search-workspace"><div class="search-query-field">${svg(icons.search, "search-field-icon")}<label class="visually-hidden" for="search-query">${s.searchDialogTitle}</label><input id="search-query" type="search" name="q" value="${escapeHtml(params.get("q") ?? "")}" placeholder="${s.searchInputPlaceholder}" autocomplete="off"><kbd>/</kbd></div><div class="search-filter-grid"><label><span>${s.searchFromLabel}</span><input type="date" name="from" value="${escapeHtml(params.get("from") ?? "")}"></label><label><span>${s.searchToLabel}</span><input type="date" name="to" value="${escapeHtml(params.get("to") ?? "")}"></label><label><span>${s.filterByTag}</span><div class="search-select-wrap"><select name="tag"><option value="">${s.searchPaletteAllTags}</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}" ${params.get("tag") === tag ? "selected" : ""}>#${escapeHtml(tag)}</option>`).join("")}</select><span class="search-select-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg></span></div></label><label><span>${s.searchCategoryLabel}</span><div class="search-select-wrap"><select name="category"><option value="">${s.searchAllCategories}</option>${allCategories.filter((category) => !category.archived).map((category) => `<option value="${category.id}" ${params.get("category") === category.id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select><span class="search-select-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg></span></div></label><label><span>${s.searchContentLabel}</span><div class="search-select-wrap"><select name="content"><option value="">${s.searchContentAll}</option><option value="todo" ${params.get("content") === "todo" ? "selected" : ""}>${s.searchOpenTasks}</option><option value="tagged" ${params.get("content") === "tagged" ? "selected" : ""}>${s.searchContentTagged}</option><option value="untagged" ${params.get("content") === "untagged" ? "selected" : ""}>${s.searchContentUntagged}</option></select><span class="search-select-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg></span></div></label><label><span>${s.searchSortLabel}</span><div class="search-select-wrap"><select name="sort"><option value="newest" ${params.get("sort") !== "oldest" ? "selected" : ""}>${s.searchSortNewest}</option><option value="oldest" ${params.get("sort") === "oldest" ? "selected" : ""}>${s.searchSortOldest}</option></select><span class="search-select-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg></span></div></label></div><div class="search-filter-footer"><p>${getLocale() === "tr" ? "Filtreler sonuçları anında günceller." : "Filters update results immediately."}</p><button type="button" class="secondary-button" id="clear-search">${s.clearSearchBtn}</button></div></form><section class="search-results-panel" aria-labelledby="search-results-title"><header><h2 id="search-results-title">${s.notesTitle}</h2><span id="search-result-count" aria-live="polite"></span></header><div id="results"></div></section></div>`;
  const form = requireElement<HTMLFormElement>("#search-form"); let timer: number; const update = () => { window.clearTimeout(timer); timer = window.setTimeout(async () => { const data = new FormData(form); const next = new URLSearchParams(); for (const key of ["q", "from", "to", "tag", "category", "content", "sort"]) { const value = data.get(key)?.toString(); if (value && !(key === "sort" && value === "newest")) next.set(key, value); } history.replaceState({}, "", appUrl(`/search${next.size ? `?${next}` : ""}`)); await renderSearchPageResults(requireElement("#results"), requireElement("#search-result-count"), data, allCategories); }, 150); }; form.addEventListener("input", update); form.addEventListener("change", update); requireElement("#clear-search").addEventListener("click", () => { form.reset(); history.replaceState({}, "", appUrl("/search")); void renderSearchPageResults(requireElement("#results"), requireElement("#search-result-count"), new FormData(form), allCategories); }); await renderSearchPageResults(requireElement("#results"), requireElement("#search-result-count"), new FormData(form), allCategories);
}

async function renderSearchPageResults(host: HTMLElement, countHost: HTMLElement, data: FormData, allCategories: Category[]): Promise<void> {
  const s = currentStrings();
  const query = data.get("q")?.toString() ?? ""; const from = data.get("from")?.toString() ?? ""; const to = data.get("to")?.toString() ?? ""; const tag = data.get("tag")?.toString() ?? ""; const category = data.get("category")?.toString() ?? ""; const content = data.get("content")?.toString() ?? ""; const sort = data.get("sort")?.toString() ?? "newest"; const categoryMap = new Map(allCategories.map((item) => [item.id, item.name])); const parsed = parseSearch(query); const wanted = normalize(parsed.text.replace(/^#/, ""));
  const matching = (await notes.listAll()).filter((note) => !note.archived && (!from || note.noteDate >= from) && (!to || note.noteDate <= to) && (!tag || note.tags.includes(tag)) && (!category || note.categoryIds.includes(category)) && (!parsed.tag || note.tags.includes(parsed.tag)) && (!parsed.category || note.categoryIds.some((id) => normalize(categoryMap.get(id) ?? "") === parsed.category)) && (!(parsed.hasTodo || content === "todo") || /^\s*[-*+]\s+\[ \]\s+/m.test(note.content)) && (content !== "tagged" || note.tags.length > 0) && (content !== "untagged" || note.tags.length === 0)).filter((note) => !wanted || notes.searchableText(note, note.categoryIds.map((id) => categoryMap.get(id) ?? "")).includes(wanted)).sort((a, b) => (sort === "oldest" ? a.noteDate.localeCompare(b.noteDate) || a.createdAt.localeCompare(b.createdAt) : b.noteDate.localeCompare(a.noteDate) || b.updatedAt.localeCompare(a.updatedAt)));
  countHost.textContent = `${matching.length} ${matching.length === 1 ? s.entrySingle : s.entryPlural}`; host.innerHTML = matching.length ? `<ol class="search-result-list">${matching.map((note) => `<li><a href="/?date=${note.noteDate}#note-${note.id}" data-link><div class="search-result-meta"><time datetime="${note.noteDate}">${formatShortDate(note.noteDate)}</time>${note.tags.slice(0, 3).map((item) => `<span>#${escapeHtml(item)}</span>`).join("")}</div><p>${escapeHtml(note.content.replace(/[#*_`>\[\]-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240))}</p></a></li>`).join("")}</ol>` : `<div class="empty-notes search-results-empty"><img src="${assetUrl("/empty-notes.png")}" alt="" width="140" height="140" class="empty-notes-illustration" aria-hidden="true"><p>${s.noNotesFound}</p><span>${s.noNotesFoundPrompt}</span></div>`; normalizeAppLinks(host);
}

async function renderSearchResults(host: HTMLElement, query: string, year: string, categoryId: string, allCategories: Category[], from = "", to = ""): Promise<void> {
  const s = currentStrings();
  const categoryMap = new Map(allCategories.map((category) => [category.id, category.name])); const parsed = parseSearch(query); const wanted = normalize(parsed.text.replace(/^#/, ""));
  const matching = (await notes.listAll()).filter((note) => !note.archived && (!year || note.noteDate.startsWith(year)) && (!from || note.noteDate >= from) && (!to || note.noteDate <= to) && (!categoryId || note.categoryIds.includes(categoryId)) && (!parsed.tag || note.tags.includes(parsed.tag)) && (!parsed.category || note.categoryIds.some((id) => normalize(categoryMap.get(id) ?? "") === parsed.category)) && (!parsed.hasTodo || /^\s*[-*+]\s+\[ \]\s+/m.test(note.content))).filter((note) => !wanted || notes.searchableText(note, note.categoryIds.map((id) => categoryMap.get(id) ?? "")).includes(wanted)).sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.updatedAt.localeCompare(a.updatedAt));
  const commands = query ? "" : `<div class="search-commands"><div class="palette-section-label">${s.quickActionsLabel}</div><a href="${appUrl("/")}" data-link data-command="new-note" class="command-item"><div class="command-item-left">${svg(icons.plus, "command-icon")}<span>${s.newNoteCommand}</span></div><kbd>N</kbd></a><a href="${appUrl("/summaries")}" data-link class="command-item"><div class="command-item-left">${svg(icons.summary, "command-icon")}<span>${s.generateSummaryCommand}</span></div></a><a href="${appUrl("/settings")}" data-link class="command-item"><div class="command-item-left">${svg(icons.settings, "command-icon")}<span>${s.settingsCommand}</span></div></a></div>`;
  host.innerHTML = !query && !year && !categoryId ? `${commands}<div class="palette-results-heading"><span>${s.searchRecentNotes}</span><span>${matching.slice(0, 5).length}</span></div>${matching.slice(0, 5).length ? searchHits(matching.slice(0, 5)) : `<div class="palette-empty"><p>${s.noNotesYet}</p><span>${s.noNotesYetPrompt}</span></div>`}` : !matching.length ? `<div class="palette-empty"><img src="${assetUrl("/empty-notes.png")}" alt="" width="96" height="96" class="empty-notes-illustration" aria-hidden="true"><p>${s.searchNoResults}</p><span>${s.searchNoResultsDesc}</span></div>` : `<div class="palette-results-heading"><span>${s.matchingNotesLabel}</span><span>${matching.length}</span></div>${searchHits(matching)}`;
  normalizeAppLinks(host);
}

function parseSearch(query: string): { text: string; tag: string; category: string; hasTodo: boolean } { let text = query; const read = (pattern: RegExp) => { const match = text.match(pattern); if (match) text = text.replace(match[0], " "); return normalize(match?.[1] ?? ""); }; const tag = read(/(?:^|\s)tag:([^\s]+)/i); const category = read(/(?:^|\s)category:([^\s]+)/i); const hasTodo = /(?:^|\s)has:todo(?:\s|$)/i.test(text); text = text.replace(/(?:^|\s)has:todo(?:\s|$)/i, " "); return { text, tag, category, hasTodo }; }
function searchHits(items: Note[]): string { const s = currentStrings(); return `<ol class="palette-result-list">${items.map((note) => { const preview = note.content.replace(/[#*_`>\[\]-]/g, " ").replace(/\s+/g, " ").trim() || s.untitledNote; return `<li><a href="${appUrl(`/?date=${note.noteDate}#note-${note.id}`)}" data-link class="palette-result-item"><div class="palette-result-icon">${svg(icons.note, "palette-icon")}</div><div class="palette-result-copy"><p class="palette-result-text">${escapeHtml(preview.slice(0, 180))}</p>${note.tags.length ? `<div class="palette-result-tags">${note.tags.slice(0, 3).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>` : ""}</div><time datetime="${note.noteDate}">${formatShortDate(note.noteDate)}</time></a></li>`; }).join("")}</ol>`; }

async function renderTodos(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const tasks = (await notes.listAll()).flatMap((note) => note.content.split(/\r?\n/).map((line, lineIndex) => ({ note, line, lineIndex })).filter(({ line }) => /^\s*[-*+]\s+\[ \]\s+/.test(line)));
  document.title = `${s.todosTitle} · Rook Lite`; content.innerHTML = `<div class="page-head"><div><h1>${s.todosTitle}</h1><p class="lede">${s.todosLede}</p></div></div>${tasks.length ? `<ul class="todo-list">${tasks.map(({ note, line, lineIndex }) => `<li class="todo-item"><label class="lite-task-check"><input type="checkbox" data-task-note="${note.id}" data-task-line="${lineIndex}"><span>${escapeHtml(line.replace(/^\s*[-*+]\s+\[ \]\s+/, ""))}</span></label><a href="/?date=${note.noteDate}#note-${note.id}" data-link class="muted">${note.noteDate}</a></li>`).join("")}</ul>` : `<div class="empty-notes lite-page-placeholder"><p>${s.noOpenTasks}</p><span>${s.noOpenTasksPrompt}</span></div>`}`;
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

export async function renderSummariesV2(content: HTMLElement): Promise<void> {
  const ollama = await settingsRepository.get<OllamaSettings>("ollama") ?? DEFAULT_OLLAMA_SETTINGS;
  const isOllamaEnabled = Boolean(ollama.enabled);
  const params = new URLSearchParams(location.search);
  const type = (["weekly", "monthly", "custom"].includes(params.get("type") ?? "") ? params.get("type") : "weekly") as "weekly" | "monthly" | "custom";
  const anchor = validIsoDate(params.get("start")) ? params.get("start") as string : isoDate(new Date());
  const end = validIsoDate(params.get("end")) ? params.get("end") as string : anchor;
  const requestedMode = params.get("mode");
  const mode = (["rule-based", "ollama", "raw"].includes(requestedMode ?? "")
    ? (requestedMode === "ollama" && !isOllamaEnabled ? "rule-based" : requestedMode)
    : "rule-based") as "rule-based" | "ollama" | "raw";
  let period; try { period = summaryPeriod(type, anchor, end); } catch { period = summaryPeriod("weekly", isoDate(new Date())); }
  const stored = await summaries.list(); const allNotes = await notes.listAll(); const allCategories = await categories.list(); const source = allNotes.filter((note) => note.noteDate >= period.start && note.noteDate <= period.end && !note.archived); const current = stored.find((summary) => summary.id === `${period.type}:${period.start}:${period.end}`); const range = `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`; const rawMarkdown = rawNotesMarkdown(source); const shownMarkdown = mode === "raw" ? rawMarkdown : current?.editedMarkdown ?? current?.generatedMarkdown;
  const s = currentStrings();
  document.title = `${s.summariesTitle} · Rook Lite`;
  content.innerHTML = `<div class="summaries-page"><header class="page-head"><div><h1>${s.summariesTitle}</h1><p class="lede">${s.summariesLede}</p></div></header><form id="summary-period-form" class="summary-control-panel"><div class="summary-period-tabs" aria-label="Summary period">${[["weekly", s.thisWeek], ["monthly", s.thisMonth], ["custom", s.customRange]].map(([value, label]) => `<button type="button" data-summary-type="${value}" class="${type === value ? "is-active" : ""}" aria-pressed="${type === value}">${label}</button>`).join("")}</div><input type="hidden" name="type" value="${type}"><div class="summary-date-fields"><label class="summary-date-label"><span>${type === "custom" ? s.startDate : s.dateInPeriod}</span><input name="start" type="date" value="${type === "custom" ? period.start : anchor}"></label><label class="summary-date-label summary-end-field" ${type === "custom" ? "" : "hidden"}><span>${s.endDate}</span><input name="end" type="date" value="${period.end}"></label></div><fieldset class="summary-mode-picker"><legend>${s.summaryMode}</legend>${([["rule-based", s.modeRuleBased, s.modeRuleBasedDesc, true], ["ollama", s.modeOllama, isOllamaEnabled ? s.modeOllamaDesc : s.modeOllamaDisabledDesc, isOllamaEnabled], ["raw", s.modeRaw, s.modeRawDesc, true]] as const).map(([value, label, help, enabled]) => `<label class="${enabled ? "" : "is-disabled"}" ${enabled ? "" : `title="${escapeHtml(s.modeOllamaDisabledDesc)}"`}><input type="radio" name="mode" value="${value}" ${mode === value ? "checked" : ""} ${enabled ? "" : "disabled"}><span><strong>${label}</strong><small>${help}</small></span></label>`).join("")}</fieldset></form><section class="summary-document" aria-labelledby="summary-document-title"><header><div><p>${source.length} ${source.length === 1 ? s.entrySingle : s.entryPlural} · ${range}</p><h2 id="summary-document-title">${type === "weekly" ? s.weekLabel(isoWeek(new Date(`${period.start}T12:00:00`))) : type === "monthly" ? formatMonthYear(new Date(`${period.start}T12:00:00`)) : s.customRange}</h2></div><div class="summary-document-actions">${shownMarkdown ? `<button type="button" class="secondary-button" id="copy-summary">${s.copySummary}</button><button type="button" class="secondary-button" id="export-summary">${s.exportSummary}</button>` : ""}${mode !== "raw" ? `<button type="button" id="generate-summary">${current ? s.regenerateSummary : s.generateSummary}</button>` : ""}</div></header><p id="summary-error" class="notice error" hidden aria-live="polite"></p>${shownMarkdown ? `<div class="summary-prose prose">${renderMarkdown(shownMarkdown)}</div>${mode !== "raw" && current ? `<details class="summary-edit"><summary>${s.editMarkdown}</summary><form id="summary-edit-form"><textarea name="text" rows="12">${escapeHtml(current.editedMarkdown ?? current.generatedMarkdown)}</textarea><button type="submit">${s.saveChanges}</button></form></details>` : ""}` : `<div class="summary-empty"><img src="${assetUrl("/logo.png")}" alt="" width="48" height="48"><h3>${s.noSummaryYet}</h3><p>${s.noSummaryYetDesc(source.length > 0)}</p></div>`}</section></div>`;
  const form = requireElement<HTMLFormElement>("#summary-period-form"); form.querySelectorAll<HTMLButtonElement>("[data-summary-type]").forEach((button) => button.addEventListener("click", () => { const nextType = button.dataset.summaryType ?? "weekly"; const next = new URLSearchParams({ type: nextType, start: isoDate(new Date()), mode: isOllamaEnabled ? mode : "rule-based" }); if (nextType === "custom") next.set("end", isoDate(new Date())); history.replaceState({}, "", appUrl(`/summaries?${next}`)); void renderRoute(); }));
  const navigate = () => { const data = new FormData(form); const selectedMode = data.get("mode")?.toString() ?? "rule-based"; const nextMode = selectedMode === "ollama" && !isOllamaEnabled ? "rule-based" : selectedMode; const next = new URLSearchParams({ type: data.get("type")?.toString() ?? "weekly", start: data.get("start")?.toString() ?? isoDate(new Date()), mode: nextMode }); if (data.get("type") === "custom") next.set("end", data.get("end")?.toString() ?? ""); history.replaceState({}, "", appUrl(`/summaries?${next}`)); void renderRoute(); }; form.addEventListener("submit", (event) => { event.preventDefault(); navigate(); }); form.querySelectorAll<HTMLInputElement>('input[type="date"], input[name="mode"]').forEach((input) => input.addEventListener("change", navigate));
  document.querySelector<HTMLButtonElement>("#generate-summary")?.addEventListener("click", async (event) => { const button = event.currentTarget as HTMLButtonElement; button.disabled = true; button.textContent = "Generating…"; const settings = await settingsRepository.get<OllamaSettings>("ollama") ?? DEFAULT_OLLAMA_SETTINGS; const engine = mode === "ollama" ? new OllamaSummaryEngine(settings) : new RuleBasedSummaryEngine(); try { const result = await summaries.generate(source, allCategories, period, engine); if (result.fallbackError) sessionStorage.setItem("summary-fallback", result.fallbackError); await renderRoute(); } catch (error) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = errorMessage(error); button.disabled = false; button.textContent = "Generate summary"; } });
  const fallback = sessionStorage.getItem("summary-fallback"); if (fallback) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = `Ollama was unavailable. Rook used the offline summary instead: ${fallback}`; sessionStorage.removeItem("summary-fallback"); }
  document.querySelector<HTMLButtonElement>("#copy-summary")?.addEventListener("click", async () => { if (shownMarkdown) await navigator.clipboard.writeText(shownMarkdown); }); document.querySelector<HTMLButtonElement>("#export-summary")?.addEventListener("click", () => { if (shownMarkdown) downloadBlob(new Blob([shownMarkdown], { type: "text/markdown" }), `rook-summary-${period.start}-${period.end}.md`); });
  document.querySelector<HTMLFormElement>("#summary-edit-form")?.addEventListener("submit", async (event) => { event.preventDefault(); if (!current) return; const editForm = event.currentTarget as HTMLFormElement; await summaries.edit(current.id, new FormData(editForm).get("text")?.toString() ?? ""); await renderRoute(); });
}

function rawNotesMarkdown(items: Note[]): string {
  const s = currentStrings();
  return items.length ? `${items.slice().sort((a, b) => a.noteDate.localeCompare(b.noteDate) || a.createdAt.localeCompare(b.createdAt)).map((note) => `## ${formatDateHeading(note.noteDate)}\n\n${note.content.trim()}`).join("\n\n")}\n` : `# ${s.notesTitle}\n\n${s.noSummaryYetDesc(false)}\n`;
}

async function renderData(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const allNotes = await notes.listAll(); const allCategories = await categories.list(); const lastExport = await settingsRepository.get<string>("lastExportAt"); document.title = `${s.dataManagementTitle} · Rook Lite`;
  content.innerHTML = `<div class="dashboard-welcome"><div class="welcome-left"><h1 class="welcome-title">${s.dataManagementTitle}</h1><p class="welcome-banner-subtitle">${s.dataManagementSubtitle}</p></div></div><p id="data-message" class="notice" hidden></p><div class="settings-stack"><section class="data-panel panel-row"><h2 class="panel-title">${s.markdownExportTitle}</h2><p class="panel-subtitle">${s.markdownExportSubtitle}</p><p class="hint">${lastExport ? `${s.lastExportPrefix} ${escapeHtml(new Date(lastExport).toLocaleString(getLocale() === "tr" ? "tr-TR" : "en-US"))}` : s.noExportYet}</p><div class="lite-panel-actions"><button id="directory-export" ${allNotes.length ? "" : "disabled"}>${s.chooseExportFolderBtn}</button><button id="zip-export" ${allNotes.length ? "" : "disabled"}>${s.downloadZipBtn}</button></div></section><section class="data-panel panel-row"><h2 class="panel-title">${s.fullBackupTitle}</h2><p class="panel-subtitle">${s.fullBackupSubtitle}</p><div class="lite-panel-actions"><button id="create-backup">${s.createJsonBackupBtn}</button><label class="save-btn-rect lite-file-label" for="restore-backup">${s.restoreJsonBackupLabel}</label><input class="visually-hidden" type="file" id="restore-backup" accept="application/json,.json"></div></section></div>`;
  document.querySelector<HTMLButtonElement>("#zip-export")?.addEventListener("click", () => downloadMarkdownZip(allNotes, allCategories));
  document.querySelector<HTMLButtonElement>("#directory-export")?.addEventListener("click", async () => { try { const count = await exportToDirectory(allNotes, allCategories); dataMessage(s.exportedNotesCount(count), false); } catch (error) { dataMessage(errorMessage(error), true); } });
  requireElement("#create-backup").addEventListener("click", async () => downloadJson(await createBackup()));
  requireElement<HTMLInputElement>("#restore-backup").addEventListener("change", async (event) => { const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (!file) return; try { const backup = parseBackup(await file.text()); showConfirm(s.replaceDataTitle, s.replaceDataMessage(backup.notes.length, backup.categories.length, backup.summaries.length), s.restoreBackupBtn, async () => { await restoreBackup(backup); await refreshCalendar(); await renderRoute(); }); } catch (error) { dataMessage(errorMessage(error), true); } });
}

export async function renderSettings(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const counts = await storageCounts();
  const ollama = await settingsRepository.get<OllamaSettings>("ollama") ?? DEFAULT_OLLAMA_SETTINGS;
  const estimate = await navigator.storage?.estimate?.();
  const persisted = await navigator.storage?.persisted?.();
  const currentTheme = (localStorage.getItem("theme-preference") ?? "SYSTEM") as ThemePreference;
  const currentLocale = getLocale();
  document.title = `${s.settingsTitle} · Rook Lite`;

  content.innerHTML = `<div class="settings-page">
    <header class="page-head">
      <div>
        <h1>${s.settingsTitle}</h1>
        <p class="lede">${s.settingsLede}</p>
      </div>
    </header>

    <div class="settings-cards-stack">
      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>${s.languageTitle}</h2>
            <p>${s.languageSubtitle}</p>
          </div>
        </div>
        <div class="theme-selector-grid language-selector-grid">
          ${getAvailableLocales().map((loc) => `
            <label class="theme-option-card ${currentLocale === loc.code ? "is-selected" : ""}">
              <input type="radio" name="settings-language" value="${loc.code}" ${currentLocale === loc.code ? "checked" : ""}>
              <div class="theme-card-icon">${svg(icons.globe, "")}</div>
              <div class="theme-card-info">
                <strong>${escapeHtml(loc.label)}</strong>
                <span>${escapeHtml(loc.description)}</span>
              </div>
            </label>
          `).join("")}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>${s.appearanceTitle}</h2>
            <p>${s.appearanceSubtitle}</p>
          </div>
        </div>
        <div class="theme-selector-grid">
          ${([
            ["SYSTEM", s.themeSystem, s.themeSystemDesc, icons.monitor],
            ["LIGHT", s.themeLight, s.themeLightDesc, icons.sun],
            ["DARK", s.themeDark, s.themeDarkDesc, icons.moon]
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
              <h2>${s.localAiTitle}</h2>
              <span class="ai-privacy-pill">${s.localAiBadge}</span>
            </div>
            <p>${s.localAiSubtitle}</p>
          </div>
          <div class="ai-toggle-wrapper">
            <label class="toggle-switch" for="ollama-enabled-toggle">
              <input type="checkbox" id="ollama-enabled-toggle" ${ollama.enabled ? "checked" : ""}>
              <span class="toggle-slider"></span>
              <span class="visually-hidden">${s.localAiTitle}</span>
            </label>
          </div>
        </div>

        <div id="ollama-disabled-banner" class="ai-disabled-banner" ${ollama.enabled ? "hidden" : ""}>
          <div class="disabled-banner-content">
            <span class="disabled-banner-icon">${svg(icons.lock, "")}</span>
            <div>
              <strong>${s.localAiDisabledTitle}</strong>
              <p>${s.localAiDisabledDesc}</p>
            </div>
          </div>
        </div>

        <div id="ollama-config-panel" class="ai-config-panel" ${ollama.enabled ? "" : "hidden"}>
          <form id="ollama-form" class="settings-form">
            <div class="form-row">
              <div class="form-field flex-2">
                <label for="ollama-endpoint">${s.ollamaEndpointLabel}</label>
                <input class="form-input" id="ollama-endpoint" name="endpoint" value="${escapeHtml(ollama.endpoint)}" placeholder="http://localhost:11434" required>
                <span class="field-hint">${s.ollamaEndpointHint}</span>
              </div>
              <div class="form-field flex-2">
                <label for="ollama-model">${s.ollamaModelLabel}</label>
                <div class="model-select-wrapper">
                  <select class="form-input" id="ollama-model" name="model" required>
                    <option value="${escapeHtml(ollama.model)}">${escapeHtml(ollama.model)}</option>
                  </select>
                </div>
                <span class="field-hint">${s.ollamaModelHint}</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field flex-1">
                <div class="field-label-row">
                  <label for="ollama-temperature">${s.ollamaTempLabel}</label>
                  <span id="temp-val-display" class="temp-badge">${Number(ollama.temperature).toFixed(2)}</span>
                </div>
                <input type="range" id="ollama-temperature" name="temperature" min="0" max="1" step="0.05" value="${ollama.temperature}" class="range-slider">
                <div class="range-labels">
                  <span>${s.ollamaTempPrecise}</span>
                  <span>${s.ollamaTempBalanced}</span>
                  <span>${s.ollamaTempCreative}</span>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field flex-1">
                <div class="field-label-row">
                  <label for="ollama-system-prompt">${s.ollamaSystemPromptLabel}</label>
                  <button type="button" id="reset-ollama-prompt" class="text-link-btn" title="${s.resetToDefault}">${s.resetToDefault}</button>
                </div>
                <textarea class="form-textarea" id="ollama-system-prompt" name="systemPrompt" rows="4" placeholder="${s.ollamaSystemPromptHint}">${escapeHtml(ollama.systemPrompt ?? DEFAULT_OLLAMA_PROMPT)}</textarea>
                <span class="field-hint">${s.ollamaSystemPromptHint}</span>
              </div>
            </div>

            <div class="ai-actions-row">
              <button type="button" id="test-ollama" class="secondary-button">${svg(icons.refresh, "btn-action-icon")}<span>${s.testConnectionBtn}</span></button>
              <button type="submit" class="save-btn-rect">${svg(icons.check, "btn-action-icon")}<span>${s.saveAiSettingsBtn}</span></button>
            </div>
            <div id="ollama-status" class="notice" hidden aria-live="polite"></div>
          </form>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>${s.storageTitle}</h2>
            <p>${s.storageSubtitle}</p>
          </div>
        </div>
        <div class="storage-metrics-grid">
          <div class="storage-metric-box">
            <span class="metric-num">${counts.notes}</span>
            <span class="metric-label">${s.metricNotes}</span>
          </div>
          <div class="storage-metric-box">
            <span class="metric-num">${counts.categories}</span>
            <span class="metric-label">${s.metricCategories}</span>
          </div>
          <div class="storage-metric-box">
            <span class="metric-num">${counts.summaries}</span>
            <span class="metric-label">${s.metricSummaries}</span>
          </div>
          <div class="storage-metric-box">
            <span class="metric-num">${estimate?.usage ? formatBytes(estimate.usage) : "Local DB"}</span>
            <span class="metric-label">${s.estimatedUsage}</span>
          </div>
        </div>
        <div class="persistence-row">
          <div class="persistence-text">
            <strong>${persisted ? `✓ ${s.persistencePersisted}` : s.persistenceBestEffort}</strong>
            <p>${s.persistenceDesc}</p>
          </div>
          ${persisted ? "" : `<button type="button" id="request-persistence" class="secondary-button">${s.requestPersistenceBtn}</button>`}
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>${s.dataManagementTitle}</h2>
            <p>${s.dataManagementSubtitle}</p>
          </div>
          <a href="${appUrl("/data")}" data-link class="secondary-button action-link-btn">${s.navData} &rarr;</a>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2>${s.aboutTitle}</h2>
            <p>${s.aboutSubtitle}</p>
          </div>
          <a href="https://github.com/volkanto/rook-lite" target="_blank" rel="noopener noreferrer" class="secondary-button action-link-btn">${svg(icons.github, "btn-action-icon")}<span>GitHub</span></a>
        </div>
      </section>

      <section class="settings-card danger-card">
        <div class="settings-card-header">
          <div class="settings-card-title-group">
            <h2 class="danger-title">${s.dangerZoneTitle}</h2>
            <p>${s.dangerZoneSubtitle}</p>
          </div>
          <button type="button" id="delete-local-data" class="danger-save-btn">${s.clearAllDataBtn}</button>
        </div>
      </section>
    </div>
  </div>`;
  bindSettingsEvents(content, ollama);
}

function bindSettingsEvents(content: HTMLElement, ollama: OllamaSettings): void {
  const s = currentStrings();
  content.querySelectorAll<HTMLInputElement>('input[name="settings-language"]').forEach((input) => {
    input.addEventListener("change", () => {
      const selected = input.value as SupportedLocale;
      if (selected === getLocale()) return;
      setLocale(selected);
      void renderShell();
    });
  });
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
    const customPrompt = data.get("systemPrompt")?.toString().trim();
    return {
      enabled: toggle.checked,
      endpoint: data.get("endpoint")?.toString().trim() ?? "",
      model: data.get("model")?.toString().trim() ?? "",
      temperature: Number(data.get("temperature") ?? 0.2),
      timeoutMs: 60000,
      systemPrompt: customPrompt || DEFAULT_OLLAMA_PROMPT
    };
  };

  content.querySelector<HTMLButtonElement>("#reset-ollama-prompt")?.addEventListener("click", () => {
    const textarea = content.querySelector<HTMLTextAreaElement>("#ollama-system-prompt");
    if (textarea) textarea.value = DEFAULT_OLLAMA_PROMPT;
  });

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
      const statusEl = document.querySelector<HTMLElement>("#ollama-status");
      if (statusEl) statusEl.hidden = true;
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
        alert(getLocale() === "tr" ? "Tarayıcı kalıcı depolama izni vermedi." : "The browser did not grant persistent storage.");
        return;
      }
      await renderRoute();
    });
  }

  content.querySelector<HTMLButtonElement>("#delete-local-data")?.addEventListener("click", () =>
    showConfirm(
      s.clearConfirmTitle,
      s.clearConfirmMessage,
      s.clearAllAction,
      async () => {
        await clearAllData();
        await categories.seedDefaults();
        await refreshCalendar();
        await renderRoute();
      }
    )
  );
}

function ollamaMessage(message: string, error: boolean): void {
  const element = requireElement<HTMLElement>("#ollama-status");
  element.hidden = false;
  element.innerHTML = `${svg(error ? icons.alert : icons.check, "notice-status-icon")}<span>${escapeHtml(message)}</span>`;
  element.classList.toggle("error", error);
}
function dataMessage(message: string, error: boolean): void { const element = requireElement<HTMLElement>("#data-message"); element.hidden = false; element.textContent = message; element.classList.toggle("error", error); }
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

function showConfirm(title: string, message: string, actionLabel: string, action: () => Promise<void>): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  host.innerHTML = `<div class="note-edit-backdrop" id="confirm-backdrop"><section class="note-edit-dialog lite-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><header class="note-edit-dialog-head"><div class="confirm-title-group"><span class="confirm-alert-icon-wrap" aria-hidden="true">${svg(icons.alert, "confirm-alert-svg")}</span><h2 id="confirm-title">${escapeHtml(title)}</h2></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}">${svg(icons.close, "dialog-close-svg")}</button></header><div class="confirm-dialog-body"><p class="confirm-dialog-message">${escapeHtml(message)}</p></div><footer class="confirm-dialog-footer"><button type="button" class="btn-secondary" data-close-dialog>${s.cancel}</button><button type="button" class="btn-danger-confirm" id="confirm-action">${escapeHtml(actionLabel)}</button></footer></section></div>`;
  document.body.style.overflow = "hidden";

  const backdrop = requireElement<HTMLElement>("#confirm-backdrop");
  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) closeDialog();
  });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      window.removeEventListener("keydown", onKeydown);
      closeDialog();
    }
  };
  window.addEventListener("keydown", onKeydown);

  requireElement<HTMLButtonElement>("#confirm-action").addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      await action();
      closeDialog();
    } catch (error) {
      button.disabled = false;
      alert(errorMessage(error));
    }
  });
}

export function closeDialog(): void { const host = document.querySelector<HTMLElement>("#dialog-host"); if (host) host.replaceChildren(); document.body.style.overflow = ""; }

export function updateBackToTopVisibility(): void {
  const streamFooter = document.querySelector<HTMLElement>(".notes-stream-footer");
  if (!streamFooter) return;

  const notesList = document.querySelector<HTMLElement>(".notes-list");
  if (!notesList) {
    streamFooter.classList.add("is-hidden");
    streamFooter.setAttribute("hidden", "");
    return;
  }

  const shell = document.querySelector<HTMLElement>(".shell");
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const listRect = notesList.getBoundingClientRect();
  const currentScroll = window.scrollY || shell?.scrollTop || 0;
  const listTotalBottom = listRect.bottom + currentScroll;

  const docOverflows = document.documentElement.scrollHeight > viewportHeight + 40;
  const shellOverflows = shell ? shell.scrollHeight > shell.clientHeight + 40 : false;
  const listOverflows = listTotalBottom > viewportHeight + 40;
  const isScrolled = currentScroll > 60;

  const shouldShow = docOverflows || shellOverflows || listOverflows || isScrolled;

  if (shouldShow) {
    streamFooter.classList.remove("is-hidden");
    streamFooter.removeAttribute("hidden");
  } else {
    streamFooter.classList.add("is-hidden");
    streamFooter.setAttribute("hidden", "");
  }
}

function renderNotFound(content: HTMLElement): void {
  const s = currentStrings();
  document.title = `${s.notFoundTitle} · Rook Lite`;
  content.innerHTML = `<div class="page-head"><div><p class="eyebrow">${s.notFoundDesc}</p><h1>${s.notFoundTitle}</h1><p class="lede"><a href="${appUrl("/")}" data-link>${s.notFoundReturnHome}</a></p></div></div>`;
}

async function updateModalSearch(): Promise<void> {
  const query = requireElement<HTMLInputElement>("#modal-search-input").value;
  const tagSelect = requireElement<HTMLSelectElement>("#modal-search-tag");
  const periodSelect = requireElement<HTMLSelectElement>("#modal-search-period");
  const todoInput = requireElement<HTMLInputElement>("#modal-search-todo");
  const tag = tagSelect.value;
  const period = periodSelect.value;
  const todo = todoInput.checked;

  tagSelect.closest(".palette-select-wrap")?.classList.toggle("is-active", Boolean(tag));
  periodSelect.closest(".palette-select-wrap")?.classList.toggle("is-active", Boolean(period));
  todoInput.closest(".filter-todo-chip")?.classList.toggle("is-active", todo);

  const terms = [query, tag ? `tag:${tag}` : "", todo ? "has:todo" : ""].filter(Boolean).join(" ");
  const range = period === "week" ? summaryPeriod("weekly", isoDate(new Date())) : period === "month" ? summaryPeriod("monthly", isoDate(new Date())) : null;
  await renderSearchResults(requireElement("#modal-search-results"), terms, "", "", await categories.list(), range?.start, range?.end);
}

let shellEventsBound = false;
function bindShellEvents(): void {
  if (shellEventsBound) return;
  shellEventsBound = true;

  window.addEventListener("resize", () => {
    updateBackToTopVisibility();
  });
  window.addEventListener("scroll", () => {
    updateBackToTopVisibility();
  }, { passive: true });
  document.querySelector(".shell")?.addEventListener("scroll", () => {
    updateBackToTopVisibility();
  }, { passive: true });

  document.addEventListener("click", async (event) => {
    const target = event.target as Element;
    const copyCodeBtn = target.closest<HTMLButtonElement>(".copy-code-btn");
    if (copyCodeBtn) {
      const wrapper = copyCodeBtn.closest(".code-block-wrapper");
      const code = wrapper?.querySelector("code")?.textContent ?? "";
      if (code) {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(code);
          } else {
            throw new Error("Clipboard API unavailable");
          }
        } catch {
          const ta = document.createElement("textarea");
          ta.value = code;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        copyCodeBtn.classList.add("is-copied");
        copyCodeBtn.innerHTML = `${svg(icons.check, "copy-code-svg")}<span class="copy-code-text">Copied!</span>`;
        window.setTimeout(() => {
          copyCodeBtn.classList.remove("is-copied");
          copyCodeBtn.innerHTML = `${svg(icons.copy, "copy-code-svg")}<span class="copy-code-text">Copy</span>`;
        }, 1500);
      }
      return;
    }
    document.querySelectorAll<HTMLDetailsElement>(".footer-category-picker[open], .date-picker[open], .note-action-menu[open], .sidebar-lang-picker[open]").forEach((details) => { if (!details.contains(target)) details.removeAttribute("open"); });
    const langBtn = target.closest<HTMLButtonElement>("[data-select-lang]");
    if (langBtn) {
      const selected = langBtn.dataset.selectLang as SupportedLocale;
      if (selected && selected !== getLocale()) {
        setLocale(selected);
        void renderShell();
      }
      return;
    }
    if (target.closest('[data-action="scroll-to-top"]')) {
      event.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
      const shell = document.querySelector<HTMLElement>(".shell");
      if (shell) {
        shell.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      }
      const textarea = document.querySelector<HTMLTextAreaElement>("#new-note-form textarea");
      if (textarea) {
        window.setTimeout(() => textarea.focus(), 350);
      }
      return;
    }
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
  document.addEventListener("input", (event) => {
    const target = event.target as Element;
    if (target.id === "modal-search-input") void updateModalSearch();
  });
  document.addEventListener("change", (event) => {
    const target = event.target as Element;
    if (
      target.id === "modal-search-tag" ||
      target.id === "modal-search-period" ||
      target.id === "modal-search-todo"
    ) {
      void updateModalSearch();
    }
  });
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
function applyTheme(): void {
  const s = currentStrings();
  const theme = (localStorage.getItem("theme-preference") ?? "SYSTEM") as ThemePreference;
  const resolved = theme === "SYSTEM" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme.toLowerCase();
  document.documentElement.dataset.theme = resolved;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0d1117" : "#f6f8fa");
  const toggle = document.querySelector<HTMLElement>(".sidebar-theme-toggle");
  if (toggle) {
    const nextLabel = resolved === "dark" ? s.themeToggleLight : s.themeToggleDark;
    toggle.setAttribute("aria-label", s.themeToggleAria);
    toggle.dataset.sidebarTooltip = nextLabel;
  }
}
function openSearch(): void {
  const modal = requireElement<HTMLElement>("#search-modal");
  const input = requireElement<HTMLInputElement>("#modal-search-input");
  input.value = "";
  requireElement<HTMLSelectElement>("#modal-search-period").value = "";
  requireElement<HTMLInputElement>("#modal-search-todo").checked = false;
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
function formatTime(createdAt: string, noteDate: string): string { return formatTimeLocale(createdAt, noteDate, isoDate(new Date()), getLocale()); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "Something went wrong."; }
function requireElement<T extends Element>(selector: string): T { const element = document.querySelector<T>(selector); if (!element) throw new Error(`Missing required element: ${selector}`); return element; }

async function start(): Promise<void> { try { setLocale(getLocale()); await initializeLocalData(); await renderShell(); } catch (error) { app.innerHTML = `<main class="shell"><p class="notice error">Rook Lite could not open local storage: ${escapeHtml(errorMessage(error))}</p></main>`; } }

void start();
if ("serviceWorker" in navigator && import.meta.env.PROD) window.addEventListener("load", () => { void navigator.serviceWorker.register(assetUrl("sw.js"), { scope: normalizeBase().prefix }); });
