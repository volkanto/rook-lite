import "./app.css";
import "./lite.css";
import { clearAllData, storageCounts } from "./db";
import { createBackup, DEFAULT_OLLAMA_SETTINGS, downloadBlob, downloadJson, downloadMarkdownZip, exportToDirectory, parseBackup, restoreBackup, settingsRepository } from "./data";
import { currentStrings, formatDateHeading, formatMonthYear, formatShortDate, formatTimeLocale, getAvailableLocales, getLocale, getLocaleDefinition, getRelativeDateInfo, setLocale, type SupportedLocale } from "./i18n";
import { escapeHtml, extractTags, renderInlineMarkdown, renderMarkdown, toggleTaskInMarkdown } from "./markdown";
import { attachTagAutocomplete } from "./tag-autocomplete";
import type { Note, OllamaSettings } from "./models";
import { appPath, appUrl, assetUrl, normalizeAppLinks, normalizeBase } from "./routing";
import { initializeLocalData, NoteService } from "./services";
import { DEFAULT_OLLAMA_PROMPT, OllamaSummaryEngine, RuleBasedSummaryEngine, summaryPeriod, SummaryService, testOllama } from "./summaries";
import { getPredefinedTemplates, getTemplateById } from "./templates";
import { findDateBacklinks, findNoteBacklinks, setWikilinkNotesIndex } from "./wikilinks";
import { buildWikilinkInsertion, getLinkPickerCandidates } from "./link-picker";
import { CommandPaletteController } from "./command-palette/commandPalette";
import type { CommandActions, CommandContext } from "./command-palette/types";
import { APP_VERSION } from "./version";
import { isAnalyticsEnabled, setAnalyticsEnabled, track } from "./analytics/analytics";

type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

interface NavigationItem { path: string; label: string; icon: string; divider?: boolean }

const notes = new NoteService();
const summaries = new SummaryService();
let draftTimer: number | undefined;
let paletteController: CommandPaletteController | null = null;
let currentActiveNote: Note | null = null;
let lastOpenedSummaryPeriodKey: string | null = null;
let appOpenedTracked = false;

export const icons = {
  link: '<path d="M9 15l6 -6"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/>',
  quote: '<path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/>',
  template: '<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M4 9h16"/><path d="M9 4v5"/>',
  home: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
  note: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v18"/><path d="M13 8l2 0"/><path d="M13 12l2 0"/>',
  todo: '<path d="M3.5 5.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 11.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 17.5l1.5 1.5l2.5 -2.5"/><path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/>',
  summary: '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6"/>',
  search: '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
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
  eye: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>',
  trash: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  more: '<path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  check: '<path d="M5 12l5 5l10 -10"/>',
  alert: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  keyboard: '<path d="M2 6a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2z"/><path d="M6 10l0 .01"/><path d="M10 10l0 .01"/><path d="M14 10l0 .01"/><path d="M18 10l0 .01"/><path d="M6 14l0 .01"/><path d="M18 14l0 .01"/><path d="M10 14l4 0"/>',
  globe: '<path d="M9 6.371c0 4.418 -2.239 6.629 -5 6.629"/><path d="M4 6.371h7"/><path d="M5 9c0 2.144 2.252 3.908 6 4"/><path d="M12 20l4 -9l4 9"/><path d="M19.1 18h-6.2"/><path d="M6.694 3l.793 .582"/>',
  github: '<path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"/>',
  chevronLeft: '<path d="M15 6l-6 6l6 6"/>',
  chevronRight: '<path d="M9 6l6 6l-6 6"/>',
  chevronDown: '<path d="M6 9l6 6l6 -6"/>',
  clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
  arrowUp: '<path d="M12 5l0 14"/><path d="M18 11l-6 -6"/><path d="M6 11l6 -6"/>',
  maximize: '<path d="M4 8v-2a2 2 0 0 1 2 -2h2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M16 20h2a2 2 0 0 0 2 -2v-2"/>',
  minimize: '<path d="M15 19v-2a2 2 0 0 1 2 -2h2"/><path d="M15 5v2a2 2 0 0 0 2 2h2"/><path d="M5 15h2a2 2 0 0 1 2 2v2"/><path d="M5 9h2a2 2 0 0 0 2 -2v-2"/>',
  copy: '<path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/>',
  plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>'
} as const;

export const navItems: readonly NavigationItem[] = [
  { path: "/", label: "Notes", icon: icons.note },
  { path: "/todos", label: "Tasks", icon: icons.todo },
  { path: "/summaries", label: "Summaries", icon: icons.summary },
  { path: "/settings", label: "Settings", icon: icons.settings }
];

export function svg(content: string, className = "nav-svg"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${content}</svg>`;
}

export async function renderShell(): Promise<void> {
  const app = requireElement<HTMLDivElement>("#app");
  const s = currentStrings();
  document.documentElement.classList.add("sidebar-collapsed");
  document.documentElement.lang = getLocale();
  app.innerHTML = `<div id="search-modal" class="modal-backdrop" aria-hidden="true"></div>
    <div id="dialog-host"></div><button type="button" class="scrim" data-action="close-sidebar" aria-label="${s.closeSidebar}"></button>
    <header class="mobile-top-bar"><button type="button" class="mobile-sidebar-open" data-action="toggle-sidebar" aria-label="${s.collapseSidebar}" aria-controls="app-sidebar" aria-expanded="false">${svg(icons.menu, "mobile-nav-svg")}</button><button type="button" class="mobile-search-btn" data-action="open-search" aria-label="${s.searchPlaceholder}"><span class="search-placeholder">${s.searchPlaceholder}</span><kbd class="search-hotkey">⌘ K</kbd></button></header>
    <div class="main-layout"><aside class="sidebar" id="app-sidebar"><div class="sidebar-brand-row"><a class="sidebar-brand" href="${appUrl("/")}" data-link aria-label="${s.brandTooltip} · v${APP_VERSION}" data-sidebar-tooltip="${s.brandTooltip} · v${APP_VERSION}"><img src="${assetUrl("/logo.png")}" alt="" width="32" height="32" class="sidebar-brand-logo"><span class="sidebar-brand-name">Rook notes</span></a><button type="button" class="sidebar-collapse-button" data-action="toggle-sidebar" aria-label="${s.collapseSidebar}" aria-controls="app-sidebar" aria-expanded="true">${svg(icons.sidebarCollapse, "collapse-svg")}<span class="sidebar-toggle-tooltip">${s.collapseSidebar}</span></button></div><div class="sidebar-search-row"><button type="button" class="sidebar-search-btn" data-action="open-search" aria-label="${s.searchPlaceholder}" data-sidebar-tooltip="${s.searchPlaceholder} (⌘K)">${svg(icons.search, "sidebar-search-svg nav-svg")}<span class="nav-label">${s.searchPlaceholder}</span><kbd class="sidebar-search-hotkey">⌘K</kbd></button></div><div class="sidebar-mobile-head"><span>${s.navNotes}</span><button type="button" class="sidebar-close" data-action="close-sidebar" aria-label="${s.closeSidebar}">${svg(icons.close, "sidebar-close-svg")}</button></div><nav>${renderNavigation()}</nav><div class="sidebar-footer"><button type="button" class="sidebar-theme-toggle" data-action="toggle-theme" aria-label="${s.themeToggleAria}" data-sidebar-tooltip="${document.documentElement.dataset.theme === "dark" ? s.themeToggleLight : s.themeToggleDark}">${svg(icons.moon, "theme-dark-icon nav-svg")}${svg(icons.sun, "theme-light-icon nav-svg")}</button><details class="sidebar-lang-picker" id="sidebar-lang-picker"><summary class="sidebar-lang-toggle" aria-label="${s.languageSelectTooltip}" data-sidebar-tooltip="${s.languageSelectTooltip}">${svg(icons.globe, "nav-svg")}</summary><div class="sidebar-lang-popover" role="menu">${getAvailableLocales().map((loc) => `<button type="button" class="lang-option-btn ${getLocale() === loc.code ? "is-active" : ""}" data-select-lang="${loc.code}"><span class="lang-option-code">${loc.code.toUpperCase()}</span><span class="lang-option-label">${escapeHtml(loc.label)}</span>${getLocale() === loc.code ? `<span class="lang-active-check">${svg(icons.check, "lang-check-svg")}</span>` : ""}</button>`).join("")}</div></details><span class="sidebar-version" title="Rook Lite v${APP_VERSION}">v${APP_VERSION}</span></div></aside><div class="shell"><main id="page-content" class="lite-shell-main" tabindex="-1"></main></div></div>`;
  initCommandPalette();
  bindShellEvents(); applyTheme(); updateSidebarButton(); await renderRoute();
}

function initCommandPalette(): void {
  const host = document.getElementById("search-modal");
  if (!host) return;

  const actions: CommandActions = {
    navigateTo: (path: string) => {
      history.pushState({}, "", appUrl(path));
      closeSearch();
      void renderRoute();
    },
    createNote: () => {
      closeSearch();
      if (appPath() !== "/") {
        history.pushState({}, "", appUrl("/"));
        void renderRoute().then(() => {
          const form = document.querySelector<HTMLFormElement>("#new-note-form");
          if (form) setEditorMode(form, "write", false);
          document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus();
        });
      } else {
        const form = document.querySelector<HTMLFormElement>("#new-note-form");
        if (form) setEditorMode(form, "write", false);
        document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus();
      }
    },
    openDatePicker: () => {
      closeSearch();
      const datePicker = document.querySelector<HTMLDetailsElement>(".date-picker");
      if (datePicker) {
        datePicker.setAttribute("open", "");
        const summary = datePicker.querySelector<HTMLElement>("summary");
        summary?.focus();
      } else {
        const date = window.prompt("Jump to date (YYYY-MM-DD):", isoDate(new Date()));
        if (date && validIsoDate(date)) {
          history.pushState({}, "", appUrl(`/?date=${date}`));
          void renderRoute();
        }
      }
    },
    shiftDate: (delta: number) => {
      closeSearch();
      const current = new URLSearchParams(location.search).get("date") ?? isoDate(new Date());
      const nextDate = shiftDate(current, delta);
      history.pushState({}, "", appUrl(`/?date=${nextDate}`));
      void renderRoute();
    },
    openTasks: () => {
      openSearch("has:task");
    },
    openSearch: (query = "") => {
      void openSearch(query);
    },
    insertTemplate: (templateMarkdown: string) => {
      closeSearch();
      void insertTemplateIntoEditor(templateMarkdown);
    },
    toggleTheme: () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "LIGHT" : "DARK");
    },
    setTheme: (theme: "LIGHT" | "DARK" | "SYSTEM") => {
      setTheme(theme);
    },
    toggleZen: () => {
      toggleZenMode();
    },
    openShortcuts: () => {
      closeSearch();
      showShortcutsDialog();
    },
    exportMarkdownZip: async () => {
      const allNotes = await notes.listAll();
      downloadMarkdownZip(allNotes);
      void track("markdown_exported");
    },
    exportMarkdownDirectory: async () => {
      try {
        const allNotes = await notes.listAll();
        await exportToDirectory(allNotes);
        void track("markdown_exported");
      } catch (err) {
        alert(errorMessage(err));
      }
    },
    createBackup: async () => {
      downloadJson(await createBackup());
      void track("backup_exported");
    },
    triggerRestoreBackup: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const backup = parseBackup(await file.text());
          const s = currentStrings();
          showConfirm(s.replaceDataTitle, s.replaceDataMessage(backup.notes.length, backup.summaries.length), s.restoreBackupBtn, async () => {
            await restoreBackup(backup);
            void track("backup_imported");
            await refreshCalendar();
            await renderRoute();
          });
        } catch (err) {
          alert(errorMessage(err));
        }
      });
      input.click();
    },
    editSelectedNote: (note: Note) => {
      closeSearch();
      showEditDialog(note);
    },
    copySelectedNote: async (note: Note) => {
      closeSearch();
      await navigator.clipboard.writeText(note.content);
    },
    deleteSelectedNote: (note: Note) => {
      closeSearch();
      const s = currentStrings();
      showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => {
        await notes.delete(note.id);
        void track("note_deleted");
        await refreshCalendar();
        await renderRoute();
      });
    },
    regenerateSummary: () => {
      closeSearch();
      document.querySelector<HTMLButtonElement>("#generate-summary")?.click();
    },
    copySummary: () => {
      closeSearch();
      document.querySelector<HTMLButtonElement>("#copy-summary")?.click();
    },
    downloadSummary: () => {
      closeSearch();
      document.querySelector<HTMLButtonElement>("#export-summary")?.click();
    }
  };

  const getContext = (): CommandContext => {
    const summaryBlock = document.querySelector(".summary-document, #summary-block");
    const summaryMd = summaryBlock?.querySelector(".prose")?.textContent ?? undefined;

    return {
      currentPath: appPath(),
      currentDate: new URLSearchParams(location.search).get("date") ?? isoDate(new Date()),
      selectedNote: currentActiveNote,
      hasSummary: Boolean(summaryBlock),
      summaryMarkdown: summaryMd,
      isZenMode: document.body.classList.contains("is-zen-mode")
    };
  };

  paletteController = new CommandPaletteController({
    hostElement: host,
    getNotes: () => notes.listAll(),
    getContext,
    actions,
    onOpen: () => {
      void track("command_palette_opened");
    },
    onNavigate: (url) => {
      const parsed = new URL(url, location.origin);
      const isSamePath = parsed.pathname === location.pathname;
      const isSameDate = (parsed.searchParams.get("date") ?? "") === (new URLSearchParams(location.search).get("date") ?? "");

      history.pushState({}, "", appUrl(url));
      closeAllDialogs();

      if (isSamePath && isSameDate && parsed.hash) {
        highlightLinkedNote(parsed.hash);
      } else {
        void renderRoute();
      }
    }
  });
}

export function renderNavigation(): string {
  const s = currentStrings();
  const items: readonly NavigationItem[] = [
    { path: "/", label: s.navNotes, icon: icons.note },
    { path: "/todos", label: s.navTodos, icon: icons.todo },
    { path: "/summaries", label: s.navSummaries, icon: icons.summary },
    { path: "/settings", label: s.navSettings, icon: icons.settings }
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

export async function renderRoute(): Promise<void> {
  const content = requireElement<HTMLElement>("#page-content"); const path = appPath();
  if (path !== "/summaries") {
    lastOpenedSummaryPeriodKey = null;
  }
  document.querySelectorAll<HTMLElement>("[data-path]").forEach((link) => link.classList.toggle("is-active", link.dataset.path === "/" ? path === "/" : path.startsWith(link.dataset.path ?? "")));
  try {
    if (path === "/") await renderToday(content); else if (path === "/search") await renderSearch(content);
    else if (path === "/summaries") await renderSummariesV2(content); else if (path === "/todos") await renderTodos(content); else if (path === "/data") await renderData(content); else if (path === "/settings") await renderSettings(content); else renderNotFound(content);
  } catch (error) { content.innerHTML = `<p class="notice error">${escapeHtml(errorMessage(error))}</p>`; }
  normalizeAppLinks(); document.body.classList.remove("sidebar-drawer-open"); content.focus({ preventScroll: true }); highlightLinkedNote();
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

export async function insertTemplateIntoEditor(templateMarkdown: string): Promise<void> {
  if (appPath() !== "/") {
    history.pushState({}, "", appUrl("/"));
    await renderRoute();
  }
  const form = (document.querySelector("#edit-note-form") ?? document.querySelector("#new-note-form")) as HTMLFormElement | null;
  if (!form) return;
  const textarea = form.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
  if (!textarea) return;

  const current = textarea.value.trim();
  if (current) {
    const s = currentStrings();
    showConfirm(
      s.replaceTemplateTitle,
      s.replaceTemplateMessage,
      s.replaceTemplateBtn,
      async () => {
        applyTemplateText(form, textarea, templateMarkdown);
      }
    );
  } else {
    applyTemplateText(form, textarea, templateMarkdown);
  }
}

function applyTemplateText(form: HTMLFormElement, textarea: HTMLTextAreaElement, templateMarkdown: string): void {
  setEditorMode(form, "write", false);
  textarea.value = templateMarkdown;
  textarea.focus();
  resizeEditor(textarea);
  updateEditorWordCount(form);
  form.classList.add("has-content");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  void track("template_used");
}

export async function renderToday(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const requested = new URLSearchParams(location.search).get("date"); const today = isoDate(new Date()); const date = validIsoDate(requested) ? requested as string : today; const isToday = date === today;
  const value = new Date(`${date}T12:00:00`); const allNotes = await notes.listAll();
  setWikilinkNotesIndex(allNotes);
  const dayNotes = await notes.listByDate(date); const draft = await notes.getDraft(date);
  const dayBacklinks = findDateBacklinks(date, allNotes);
  const heading = formatDateHeading(date); const previous = shiftDate(date, -1); const next = shiftDate(date, 1); const selectedTag = new URLSearchParams(location.search).get("tag") ?? ""; const visibleNotes = selectedTag ? dayNotes.filter((note) => note.tags.includes(selectedTag)) : dayNotes; const frequentTags = tagCounts(dayNotes).slice(0, 6); document.title = `${heading} · Rook Lite`;

  const relativeInfo = getRelativeDateInfo(date, today, getLocale());

  content.innerHTML = `<header class="notes-day-header minimal-date-header"><div class="minimal-date-bar"><div class="minimal-date-info"><h1 class="minimal-date-title">${heading}</h1><span class="minimal-date-badge ${relativeInfo.status === "today" ? "is-today" : ""}"><span>${relativeInfo.label}</span></span></div><div class="minimal-date-nav" role="navigation" aria-label="${s.dateNavigation}"><a href="${appUrl(`/?date=${previous}`)}" data-link class="minimal-nav-btn prev-btn date-nav-arrow" aria-label="${s.previousDay}" title="${s.previousDay}">${svg(icons.chevronLeft, "minimal-nav-svg")}</a><a href="${appUrl("/")}" data-link class="minimal-today-link date-today-btn ${isToday ? "is-active" : ""}" ${isToday ? 'aria-disabled="true" tabindex="-1"' : `title="${s.today}"`}>${s.today}</a><a href="${appUrl(`/?date=${next}`)}" data-link class="minimal-nav-btn next-btn date-nav-arrow" aria-label="${s.nextDay}" title="${s.nextDay}">${svg(icons.chevronRight, "minimal-nav-svg")}</a><details class="date-picker minimal-picker"><summary class="minimal-calendar-btn" aria-label="${s.openCalendar}" title="${s.openCalendar}">${svg(icons.calendar, "minimal-nav-svg")}</summary><div class="date-picker-popover" id="notes-calendar"></div></details></div></div></header><div class="copilot-input-container">${editorMarkup("new-note-form", draft?.content ?? "", s.finishNote)}</div><section class="day-notes notes-panel" aria-labelledby="day-notes-title"><div class="section-head"><div class="notes-panel-heading"><h2 id="day-notes-title">${s.notesTitle}</h2><span class="notes-count-badge">${visibleNotes.length} ${visibleNotes.length === 1 ? s.entrySingle : s.entryPlural}</span></div>${frequentTags.length ? `<nav class="tag-filters" aria-label="${s.filterByTag}"><a href="/?date=${date}" data-link class="${selectedTag ? "" : "is-active"}" ${selectedTag ? "" : 'aria-current="page"'}>${s.filterAll}</a>${frequentTags.map(([tag]) => `<a href="/?date=${date}&tag=${encodeURIComponent(tag)}" data-link class="${selectedTag === tag ? "is-active" : ""}" ${selectedTag === tag ? 'aria-current="page"' : ""}>#${escapeHtml(tag)}</a>`).join("")}</nav>` : ""}</div>${visibleNotes.length ? `<div class="notes-list">${visibleNotes.map((note) => noteMarkup(note, allNotes, date)).join("")}</div><footer class="notes-stream-footer is-hidden" hidden><button type="button" class="back-to-top-link" data-action="scroll-to-top" aria-label="${s.backToTop}">${svg(icons.arrowUp, "back-to-top-icon")}<span>${s.backToTop}</span><kbd class="shortcut-kbd-hint">⌘↑</kbd></button></footer>` : `<div class="empty-notes"><img src="${assetUrl("/empty-notes.png")}" alt="" width="140" height="140" class="empty-notes-illustration" aria-hidden="true"><p>${selectedTag ? s.noNotesForTag(selectedTag) : s.noNotesToday}</p><span>${s.emptyNotesPrompt}</span></div>`}</section>${dayBacklinks.length ? `<section class="day-mentions-panel notes-panel" aria-labelledby="day-mentions-title"><div class="section-head"><div class="notes-panel-heading"><h3 id="day-mentions-title" class="panel-subtitle">${svg(icons.link, "backlink-icon-svg")}<span>${s.linkedMentionsTitle}</span></h3><span class="notes-count-badge">${dayBacklinks.length}</span></div></div><div class="day-mentions-list">${dayBacklinks.map((bl) => `<div class="day-mention-item"><a href="${appUrl(`/?date=${bl.sourceNote.noteDate}#note-${bl.sourceNote.id}`)}" data-link class="mention-date-badge" title="${s.openCalendar}">${formatShortDate(bl.sourceNote.noteDate)}</a><span class="day-mention-snippet-rendered prose">${renderInlineMarkdown(bl.snippet)}</span></div>`).join("")}</div></section>` : ""}`;
  renderCalendar(requireElement("#notes-calendar"), value, date, allNotes);
  bindCreateEditor(date); bindNoteActions();
  updateScrollToTopVisibility();
  requestAnimationFrame(() => updateScrollToTopVisibility());
}

function editorMarkup(id: string, value: string, label: string, isModal = false): string {
  const s = currentStrings();
  const isSubmitDisabled = !isModal && !value.trim();
  return `<form class="editor-card ${isModal ? "editor-card-modal" : ""}" id="${id}" novalidate><div class="simple-editor-toolbar" aria-label="${s.markdownFormatting}"><div class="editor-tools-cluster"><button type="button" data-format="heading" aria-label="Heading" title="Add heading"><strong>H</strong></button><button type="button" data-format="bold" aria-label="${s.toolBold}" title="${s.toolBold}"><strong>B</strong></button><button type="button" data-format="italic" aria-label="${s.toolItalic}" title="${s.toolItalic}"><em>I</em></button><button type="button" data-format="quote" class="editor-tool-quote" aria-label="${s.toolQuote}" title="${s.toolQuote}">${svg(icons.quote, "editor-tool-svg")}</button><button type="button" data-format="code" aria-label="${s.toolCode}" title="${s.toolCode}">&lt;&gt;</button><button type="button" data-format="wikilink" class="editor-tool-wikilink" aria-label="${s.insertWikilink}" title="${s.insertWikilink} ([[)">${svg(icons.link, "editor-tool-svg")}</button><span class="editor-tool-sep" aria-hidden="true"></span><button type="button" data-format="numbered" aria-label="Numbered list" title="Add a numbered list"><span class="tool-num-icon">1. ≡</span></button><button type="button" data-format="list" aria-label="${s.toolBulletList}" title="${s.toolBulletList}">• ≡</button><button type="button" data-format="task" aria-label="${s.toolChecklist}" title="${s.toolChecklist}">✓ ≡</button></div><div class="editor-toolbar-actions"><details class="editor-template-picker"><summary class="editor-mode-btn editor-template-btn" title="${s.toolTemplates}" aria-label="${s.toolTemplates}">${svg(icons.template, "editor-mode-svg")}</summary><div class="editor-template-menu" role="menu">${getPredefinedTemplates(getLocale()).map((tmpl) => `<button type="button" class="editor-template-item" data-insert-template="${tmpl.id}"><strong>${escapeHtml(tmpl.name)}</strong><span>${escapeHtml(tmpl.description)}</span></button>`).join("")}</div></details><div class="editor-mode-toggle" role="tablist" aria-label="${s.editorViewMode}"><button type="button" class="editor-mode-btn is-active" data-editor-mode="write" role="tab" aria-selected="true" title="${s.editorWrite}" aria-label="${s.editorWrite}">${svg(icons.edit, "editor-mode-svg")}</button><button type="button" class="editor-mode-btn" data-editor-mode="preview" role="tab" aria-selected="false" title="${s.editorPreview}" aria-label="${s.editorPreview}">${svg(icons.eye, "editor-mode-svg")}</button><span class="editor-tool-sep" aria-hidden="true"></span><button type="button" class="editor-mode-btn editor-zen-btn" data-action="toggle-zen" title="${s.zenMode} (⌘D)" aria-label="${s.zenMode}">${svg(icons.maximize, "editor-mode-svg")}</button></div></div></div><textarea id="${id}-body" name="bodyMarkdown" rows="${isModal ? 6 : 1}" aria-label="${s.notesTitle}" placeholder="${s.composerPlaceholder}" class="editor-textarea simple-editor-textarea">${escapeHtml(value)}</textarea><div class="editor-preview prose is-hidden" id="${id}-preview" aria-live="polite"></div><div class="simple-editor-footer"><div class="editor-footer-left editor-footer-meta"><span class="editor-word-count" aria-live="polite"></span><span class="simple-editor-hint editor-save-hint" data-save-status aria-live="polite">${isModal ? '<span class="shortcut-kbd-hint"><kbd>⌘Enter</kbd></span>' : (value ? s.draftRestored : s.markdownSupported)}</span></div><div class="editor-modal-actions">${isModal ? `<button type="button" class="btn-secondary" data-close-dialog>${s.cancel}</button>` : ""}<button type="submit" class="save-btn-rect"${isSubmitDisabled ? " disabled" : ""}>${isModal ? `${svg(icons.check, "save-icon-svg")}<span>${label}</span>` : label}</button></div></div></form>`;
}

function noteMarkup(note: Note, allNotes: Note[] = [], selectedDate = note.noteDate): string {
  const s = currentStrings();
  const backlinks = allNotes.length ? findNoteBacklinks(note, allNotes) : [];
  return `<div class="note-list-item"><article class="note" id="note-${note.id}" data-note-id="${note.id}"><header class="note-header"><div class="note-header-left"><time datetime="${note.createdAt}" class="note-time-text">${formatTime(note.createdAt, note.noteDate)}</time></div><div class="note-header-actions"><button type="button" class="note-quick-action-btn copy-btn" data-copy-note="${note.id}" aria-label="${s.copyNote}" title="${s.copyNote}">${svg(icons.copy, "action-icon-svg")}</button><button type="button" class="note-quick-action-btn edit-btn" data-edit-note="${note.id}" aria-label="${s.editNote}" title="${s.editNote}">${svg(icons.edit, "action-icon-svg")}</button><button type="button" class="note-quick-action-btn delete-btn" data-delete-note="${note.id}" aria-label="${s.deleteNote}" title="${s.deleteNote}">${svg(icons.trash, "action-icon-svg")}</button></div></header><div class="prose">${renderMarkdown(note.content, true)}</div>${backlinks.length ? `<div class="note-backlinks"><div class="note-backlinks-header">${svg(icons.link, "backlink-icon-svg")}<span>${backlinks.length} ${backlinks.length === 1 ? s.backlinkSingle : s.backlinkPlural}</span></div><ul class="note-backlinks-list">${backlinks.map((bl) => `<li class="note-backlink-item"><a href="${appUrl(`/?date=${bl.sourceNote.noteDate}#note-${bl.sourceNote.id}`)}" data-link class="backlink-date-badge" title="${s.openCalendar}">${formatShortDate(bl.sourceNote.noteDate)}</a><span class="backlink-snippet-rendered prose">${renderInlineMarkdown(bl.snippet)}</span></li>`).join("")}</ul></div>` : ""}${note.tags.length ? `<div class="note-tags">${note.tags.map((tag) => `<a href="/?date=${selectedDate}&tag=${encodeURIComponent(tag)}" data-link class="tag-pill">#${escapeHtml(tag)}</a>`).join("")}</div>` : ""}</article></div>`;
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
  const weekDays = getLocaleDefinition().dayInitials ?? ["M", "T", "W", "T", "F", "S", "S"];
  host.innerHTML = `<div class="calendar-popover-head"><button type="button" data-calendar-month="${isoDate(previousMonth)}" aria-label="${s.previousDay}">‹</button><strong>${monthLabel}</strong><button type="button" data-calendar-month="${isoDate(nextMonth)}" aria-label="${s.nextDay}">›</button></div><div class="calendar-weekdays"><span>Wk</span>${weekDays.map((day) => `<span>${day}</span>`).join("")}<span></span></div><div class="calendar-weeks">${rows.join("")}</div><div class="calendar-legend"><span><i></i> ${s.dayHasNotes}</span><span>${s.weeklyTotalsRight}</span></div>`;
  host.querySelectorAll<HTMLButtonElement>("[data-calendar-month]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      renderCalendar(host, new Date(`${button.dataset.calendarMonth}T12:00:00`), selectedDate, allNotes);
    })
  );
}

export function setEditorMode(form: HTMLFormElement, mode: "write" | "preview", shouldFocus = true): void {
  const writeBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
  const previewBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
  const textarea = form.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
  const previewPane = form.querySelector<HTMLElement>(".editor-preview");
  const toolsCluster = form.querySelector<HTMLElement>(".editor-tools-cluster");
  const hintEl = form.querySelector<HTMLElement>(".simple-editor-hint");

  if (!writeBtn || !previewBtn || !textarea || !previewPane) return;

  if (mode === "write") {
    writeBtn.classList.add("is-active");
    writeBtn.setAttribute("aria-selected", "true");
    previewBtn.classList.remove("is-active");
    previewBtn.setAttribute("aria-selected", "false");
    textarea.classList.remove("is-hidden");
    previewPane.classList.add("is-hidden");
    toolsCluster?.classList.remove("is-hidden");
    if (hintEl) hintEl.classList.remove("is-hidden");
    form.classList.remove("is-preview");
    const hasText = Boolean(textarea.value.trim());
    form.classList.toggle("has-content", hasText || textarea.value.includes("\n") || form.contains(document.activeElement));
    if (shouldFocus) {
      textarea.focus();
    }
  } else {
    previewBtn.classList.add("is-active");
    previewBtn.setAttribute("aria-selected", "true");
    writeBtn.classList.remove("is-active");
    writeBtn.setAttribute("aria-selected", "false");
    textarea.classList.add("is-hidden");
    previewPane.classList.remove("is-hidden");
    toolsCluster?.classList.add("is-hidden");
    if (hintEl) hintEl.classList.add("is-hidden");
    form.classList.add("is-preview");
    form.classList.add("has-content");

    const content = textarea.value.trim();
    if (content) {
      previewPane.innerHTML = renderMarkdown(content, true);
      normalizeAppLinks(previewPane);
    } else {
      const s = currentStrings();
      previewPane.innerHTML = `<p class="editor-preview-empty">${s.editorEmptyPreview}</p>`;
    }
  }
}

function bindEditorPreview(form: HTMLFormElement): void {
  const writeBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
  const previewBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');

  writeBtn?.addEventListener("click", () => setEditorMode(form, "write", true));
  previewBtn?.addEventListener("click", () => setEditorMode(form, "preview", false));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function updateEditorWordCount(form: HTMLFormElement): void {
  const textarea = form.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
  const countEl = form.querySelector<HTMLElement>(".editor-word-count");
  if (!textarea || !countEl) return;
  const count = countWords(textarea.value);
  const s = currentStrings();
  countEl.textContent = count > 0 ? s.wordCount(count) : "";
}

function toggleZenMode(targetForm?: HTMLFormElement): void {
  const isZen = document.body.classList.toggle("is-zen-mode");
  const s = currentStrings();
  document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-zen"]').forEach((btn) => {
    btn.classList.toggle("is-active", isZen);
    btn.innerHTML = `${svg(isZen ? icons.minimize : icons.maximize, "editor-mode-svg")}`;
    const label = isZen ? s.exitZenMode : s.zenMode;
    btn.setAttribute("title", `${label} (⌘D)`);
    btn.setAttribute("aria-label", label);
  });
  const formToFocus = targetForm ?? document.querySelector<HTMLFormElement>("#edit-note-form, #new-note-form");
  if (formToFocus) {
    const textarea = formToFocus.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    if (isZen) {
      if (textarea) textarea.style.height = "";
      textarea?.focus();
    }
  }
  if (!isZen) {
    document.querySelectorAll<HTMLTextAreaElement>("textarea.simple-editor-textarea").forEach((ta) => {
      ta.style.height = "auto";
      resizeEditor(ta);
    });
    const composer = document.querySelector<HTMLFormElement>("#new-note-form");
    if (composer) {
      const compTa = composer.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
      const hasText = Boolean(compTa?.value.trim());
      const isFocused = composer.contains(document.activeElement) || Boolean(composer.querySelector(".editor-template-picker[open]"));
      const isPreview = composer.classList.contains("is-preview");
      composer.classList.toggle("has-content", hasText || Boolean(compTa?.value.includes("\n")) || isFocused || isPreview);
      const submitBtn = composer.querySelector<HTMLButtonElement>("button[type='submit']");
      if (submitBtn) submitBtn.disabled = !hasText;
      if (!hasText && !compTa?.value.includes("\n") && !isFocused && !isPreview) {
        if (compTa) compTa.style.height = "";
      }
    }
  }
}

function bindCreateEditor(date: string): void {
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
      textarea.value = "";
      resizeEditor(textarea);
      updateComposer();
      await notes.create(content, date);
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

function bindNoteActions(): void {
  const s = currentStrings();
  document.querySelectorAll<HTMLButtonElement>("[data-delete-note]").forEach((button) => button.addEventListener("click", () => showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => { await notes.delete(button.dataset.deleteNote ?? ""); void track("note_deleted"); await refreshCalendar(); await renderRoute(); })));
  document.querySelectorAll<HTMLButtonElement>("[data-edit-note]").forEach((button) => button.addEventListener("click", async () => { const note = (await notes.listAll()).find((item) => item.id === button.dataset.editNote); if (note) showEditDialog(note); }));
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

export function showEditDialog(note: Note): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const formattedDate = formatDateHeading(note.noteDate);
  void notes.listAll().then((all) => setWikilinkNotesIndex(all));

  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop";
  backdrop.id = "edit-note-backdrop";
  backdrop.innerHTML = `<section class="note-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="note-edit-title"><header class="note-edit-dialog-head"><div class="note-edit-dialog-title-group"><span class="note-edit-icon-badge" aria-hidden="true">${svg(icons.edit, "note-edit-icon-svg")}</span><h2 id="note-edit-title">${s.editNoteTitle}</h2><a href="${appUrl(`/?date=${note.noteDate}`)}" data-link class="note-edit-date-badge" title="${s.openCalendar}">${svg(icons.calendar, "badge-calendar-svg")}<span>${formattedDate}</span></a></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}" title="${s.closeEditor} (Esc)">${svg(icons.close, "dialog-close-svg")}</button></header><div class="note-modal-form">${editorMarkup("edit-note-form", note.content, s.saveChanges, true)}</div></section>`;
  host.replaceChildren(backdrop);
  document.body.style.overflow = "hidden";

  const cleanup = () => {
    window.removeEventListener("keydown", onKeydown);
  };

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      cleanup();
      closeDialog(backdrop);
    }
  });
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      const currentHost = document.querySelector<HTMLElement>("#dialog-host");
      if (currentHost && currentHost.lastElementChild !== backdrop) return;
      cleanup();
      closeDialog(backdrop);
    }
  };
  window.addEventListener("keydown", onKeydown);
  const form = requireElement<HTMLFormElement>("#edit-note-form");
  const textarea = requireElement<HTMLTextAreaElement>("#edit-note-form textarea");
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
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!textarea.value.trim()) {
      showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => {
        await notes.delete(note.id);
        void track("note_deleted");
        closeDialog();
        await refreshCalendar();
        await renderRoute();
      });
      return;
    }
    setBusy(form, true);
    try {
      await notes.update(note.id, textarea.value);
      cleanup();
      closeDialog(backdrop);
      await renderRoute();
    } catch (error) {
      status(form, errorMessage(error), true);
      setBusy(form, false);
    }
  });
}

export function showShortcutsDialog(): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl";

  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop shortcuts-backdrop";
  backdrop.id = "shortcuts-backdrop";
  backdrop.innerHTML = `<section class="note-edit-dialog shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-dialog-title"><header class="note-edit-dialog-head"><div class="shortcuts-dialog-title-group"><span class="note-edit-icon-badge" aria-hidden="true">${svg(icons.keyboard, "note-edit-icon-svg")}</span><h2 id="shortcuts-dialog-title">${s.keyboardShortcutsTitle}</h2></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}" title="${s.closeEditor} (Esc)">${svg(icons.close, "dialog-close-svg")}</button></header><div class="shortcuts-dialog-body"><section class="shortcuts-group"><h3>${s.shortcutsNavTitle}</h3><dl class="shortcuts-grid"><div class="shortcut-entry"><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>${s.shortcutPrevNextDay}</dd></div><div class="shortcut-entry"><dt><kbd>T</kbd></dt><dd>${s.shortcutToday}</dd></div><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>↑</kbd> <span class="shortcut-or">/</span> <kbd>Home</kbd></dt><dd>${s.shortcutScrollTop}</dd></div></dl></section><section class="shortcuts-group"><h3>${s.shortcutsEditorTitle}</h3><dl class="shortcuts-grid"><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>Enter</kbd></dt><dd>${s.shortcutSaveNote}</dd></div><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>D</kbd></dt><dd>${s.shortcutZenMode}</dd></div><div class="shortcut-entry"><dt><kbd>*</kbd><kbd>Space</kbd></dt><dd>${s.shortcutBulletList}</dd></div><div class="shortcut-entry"><dt><kbd>-</kbd><kbd>[</kbd><kbd>]</kbd><kbd>Space</kbd></dt><dd>${s.shortcutChecklist}</dd></div></dl></section><section class="shortcuts-group"><h3>${s.shortcutsGeneralTitle}</h3><dl class="shortcuts-grid"><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>K</kbd> <span class="shortcut-or">/</span> <kbd>/</kbd></dt><dd>${s.shortcutCommandPalette}</dd></div><div class="shortcut-entry"><dt><kbd>?</kbd></dt><dd>${s.shortcutHelp}</dd></div><div class="shortcut-entry"><dt><kbd>Esc</kbd></dt><dd>${s.shortcutEscape}</dd></div></dl></section></div></section>`;

  host.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("keydown", onKeydown);
      closeDialog(backdrop);
    }
  });
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("keydown", onKeydown);
      closeDialog(backdrop);
    }
  };
  window.addEventListener("keydown", onKeydown);
}

export async function renderSearch(content: HTMLElement): Promise<void> {
  const q = new URLSearchParams(location.search).get("q") ?? "";
  history.replaceState({}, "", appUrl("/"));
  await renderToday(content);
  void openSearch(q);
}

export function formatTaskAge(noteDate: string, todayIso = isoDate(new Date())): { label: string; ageClass: "fresh" | "aging" | "stale" } {
  const s = currentStrings();
  const noteTime = new Date(`${noteDate}T12:00:00`).getTime();
  const todayTime = new Date(`${todayIso}T12:00:00`).getTime();
  const days = Math.max(0, Math.round((todayTime - noteTime) / (1000 * 60 * 60 * 24)));

  if (days === 0) {
    return { label: s.taskAgeToday, ageClass: "fresh" };
  }
  if (days < 3) {
    return { label: s.taskAgeDays(days), ageClass: "fresh" };
  }
  if (days < 7) {
    return { label: s.taskAgeDays(days), ageClass: "aging" };
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return { label: s.taskAgeWeeks(weeks), ageClass: "stale" };
  }
  const months = Math.floor(days / 30);
  return { label: s.taskAgeMonths(months), ageClass: "stale" };
}

export type TodoGrouping = "date" | "tag" | "all";

export interface TaskItem {
  note: Note;
  line: string;
  lineIndex: number;
}

export interface TodoGroup {
  id: string;
  title: string;
  count: number;
  tasks: TaskItem[];
}

export function groupTasks(
  tasks: TaskItem[],
  grouping: TodoGrouping,
  todayIso = isoDate(new Date())
): TodoGroup[] {
  const s = currentStrings();
  if (grouping === "all") {
    return [{ id: "all", title: "", count: tasks.length, tasks }];
  }

  if (grouping === "date") {
    const todayTasks: TaskItem[] = [];
    const yesterdayTasks: TaskItem[] = [];
    const thisWeekTasks: TaskItem[] = [];
    const earlierTasks: TaskItem[] = [];

    const todayTime = new Date(`${todayIso}T12:00:00`).getTime();
    const sorted = [...tasks].sort((a, b) => b.note.noteDate.localeCompare(a.note.noteDate));

    for (const item of sorted) {
      const noteTime = new Date(`${item.note.noteDate}T12:00:00`).getTime();
      const days = Math.round((todayTime - noteTime) / (1000 * 60 * 60 * 24));
      if (days <= 0) {
        todayTasks.push(item);
      } else if (days === 1) {
        yesterdayTasks.push(item);
      } else if (days <= 7) {
        thisWeekTasks.push(item);
      } else {
        earlierTasks.push(item);
      }
    }

    const groups: TodoGroup[] = [];
    if (todayTasks.length > 0) {
      groups.push({ id: "today", title: s.todoGroupToday, count: todayTasks.length, tasks: todayTasks });
    }
    if (yesterdayTasks.length > 0) {
      groups.push({ id: "yesterday", title: s.todoGroupYesterday, count: yesterdayTasks.length, tasks: yesterdayTasks });
    }
    if (thisWeekTasks.length > 0) {
      groups.push({ id: "this-week", title: s.todoGroupThisWeek, count: thisWeekTasks.length, tasks: thisWeekTasks });
    }
    if (earlierTasks.length > 0) {
      groups.push({ id: "earlier", title: s.todoGroupEarlier, count: earlierTasks.length, tasks: earlierTasks });
    }
    return groups;
  }

  if (grouping === "tag") {
    const tagBuckets = new Map<string, TaskItem[]>();
    const untaggedTasks: TaskItem[] = [];

    for (const item of tasks) {
      const lineTags = extractTags(item.line);
      const tags = lineTags.length > 0 ? lineTags : item.note.tags;
      const primaryTag = tags?.[0];

      if (primaryTag) {
        const bucket = tagBuckets.get(primaryTag) ?? [];
        bucket.push(item);
        tagBuckets.set(primaryTag, bucket);
      } else {
        untaggedTasks.push(item);
      }
    }

    const sortedTags = [...tagBuckets.keys()].sort((a, b) => a.localeCompare(b));
    const groups: TodoGroup[] = [];

    for (const tag of sortedTags) {
      const tagTasks = tagBuckets.get(tag) ?? [];
      if (tagTasks.length > 0) {
        groups.push({
          id: `tag-${tag}`,
          title: `#${tag}`,
          count: tagTasks.length,
          tasks: tagTasks
        });
      }
    }

    if (untaggedTasks.length > 0) {
      groups.push({
        id: "untagged",
        title: s.todoGroupUntagged,
        count: untaggedTasks.length,
        tasks: untaggedTasks
      });
    }

    return groups;
  }

  return [{ id: "all", title: "", count: tasks.length, tasks }];
}

function todoItemMarkup(item: TaskItem): string {
  const s = currentStrings();
  const { note, line, lineIndex } = item;
  const age = formatTaskAge(note.noteDate);
  const noteHeading = note.title?.trim()
    ? `${s.goToNote}: ${note.title.trim()} · ${formatShortDate(note.noteDate)}`
    : `${s.goToNote} · ${formatShortDate(note.noteDate)}`;
  return `<li class="todo-item"><label class="lite-task-check"><input type="checkbox" data-task-note="${note.id}" data-task-line="${lineIndex}"><span>${escapeHtml(
    line.replace(/^\s*[-*+]\s+\[ \]\s+/, "")
  )}</span></label><div class="todo-item-meta"><span class="todo-age-chip age-${age.ageClass}">${age.label}</span><a href="${appUrl(
    `/?date=${note.noteDate}#note-${note.id}`
  )}" data-link class="todo-note-link todo-note-jump" data-tooltip="${escapeHtml(noteHeading)}" aria-label="${escapeHtml(noteHeading)}"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="todo-jump-svg" aria-hidden="true"><path d="M4 12L12 4M12 4H6M12 4V10"/></svg></a></div></li>`;
}

export async function renderTodos(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const allNotes = await notes.listAll();
  const tasks: TaskItem[] = allNotes
    .filter((note) => !note.archived)
    .flatMap((note) =>
      note.content
        .split(/\r?\n/)
        .map((line, lineIndex) => ({ note, line, lineIndex }))
        .filter(({ line }) => /^\s*[-*+]\s+\[ \]\s+/.test(line))
    );

  document.title = `${s.todosTitle} · Rook Lite`;

  if (!tasks.length) {
    content.innerHTML = `<div class="page-head"><div><h1>${s.todosTitle}</h1><p class="lede">${s.todosLede}</p></div></div><div class="empty-notes lite-page-placeholder"><p>${s.noOpenTasks}</p><span>${s.noOpenTasksPrompt}</span></div>`;
    return;
  }

  const params = new URLSearchParams(location.search);
  const paramGroup = params.get("group");
  let storedGroup: string | null = null;
  try {
    storedGroup = localStorage.getItem("rook_todos_grouping");
  } catch {
    // ignore
  }

  const validGroupings: TodoGrouping[] = ["date", "tag", "all"];
  const grouping: TodoGrouping = validGroupings.includes(paramGroup as TodoGrouping)
    ? (paramGroup as TodoGrouping)
    : validGroupings.includes(storedGroup as TodoGrouping)
    ? (storedGroup as TodoGrouping)
    : "date";

  const groups = groupTasks(tasks, grouping);

  content.innerHTML = `<div class="page-head"><div><h1>${s.todosTitle}</h1><p class="lede">${s.todosLede}</p></div><div class="todo-group-tabs" role="tablist" aria-label="${escapeHtml(s.todoGroupBy)}"><button type="button" role="tab" data-todo-group="date" class="${grouping === "date" ? "is-active" : ""}" aria-selected="${grouping === "date"}">${s.todoGroupDate}</button><button type="button" role="tab" data-todo-group="tag" class="${grouping === "tag" ? "is-active" : ""}" aria-selected="${grouping === "tag"}">${s.todoGroupTag}</button><button type="button" role="tab" data-todo-group="all" class="${grouping === "all" ? "is-active" : ""}" aria-selected="${grouping === "all"}">${s.todoGroupAll}</button></div></div><div class="todo-groups-container">${groups
    .map(
      (group) => `<section class="todo-group" data-group-id="${group.id}">${group.title ? `<header class="todo-group-header"><h2 class="todo-group-title"><span>${escapeHtml(group.title)}</span><span class="todo-group-count">${group.count}</span></h2></header>` : ""}<ul class="todo-list">${group.tasks
        .map((task) => todoItemMarkup(task))
        .join("")}</ul></section>`
    )
    .join("")}</div>`;

  content.querySelectorAll<HTMLButtonElement>("[data-todo-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextGroup = (btn.dataset.todoGroup as TodoGrouping) || "date";
      try {
        localStorage.setItem("rook_todos_grouping", nextGroup);
      } catch {
        // ignore
      }
      const nextUrl = new URL(location.href);
      if (nextGroup === "date") {
        nextUrl.searchParams.delete("group");
      } else {
        nextUrl.searchParams.set("group", nextGroup);
      }
      history.replaceState({}, "", nextUrl.pathname + nextUrl.search);
      void renderTodos(content);
    });
  });

  content.querySelectorAll<HTMLInputElement>("[data-task-note]").forEach((input) =>
    input.addEventListener("change", async () => {
      input.disabled = true;
      const item = input.closest<HTMLElement>(".todo-item");
      if (item) {
        item.classList.add("is-completing");
      }
      const isReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const animationWait = isReducedMotion ? 40 : 700;

      const savePromise = notes.setTaskDone(input.dataset.taskNote ?? "", Number(input.dataset.taskLine), input.checked);

      try {
        await Promise.all([
          savePromise,
          new Promise((resolve) => setTimeout(resolve, animationWait))
        ]);
        await renderRoute();
      } catch (error) {
        if (item) {
          item.classList.remove("is-completing");
        }
        input.checked = false;
        input.disabled = false;
        alert(errorMessage(error));
      }
    })
  );
}

export async function renderSummaries(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const params = new URLSearchParams(location.search); const type = (["weekly", "monthly", "yearly", "custom"].includes(params.get("type") ?? "") ? params.get("type") : "weekly") as "weekly" | "monthly" | "yearly" | "custom"; const anchor = validIsoDate(params.get("start")) ? params.get("start") as string : isoDate(new Date()); const end = validIsoDate(params.get("end")) ? params.get("end") as string : anchor;
  let period; try { period = summaryPeriod(type, anchor, end); } catch { period = summaryPeriod("weekly", isoDate(new Date())); }
  const stored = await summaries.list(); const allNotes = await notes.listAll(); const current = stored.find((summary) => summary.id === `${period.type}:${period.start}:${period.end}`);
  document.title = "Summaries · Rook Lite";
  content.innerHTML = `<div class="page-head"><div><h1>Summaries</h1><p class="lede">Turn your local notes into an overview without sending them anywhere.</p></div></div><form id="summary-period-form" class="search-page-form lite-summary-controls"><div class="search-page-controls"><div class="search-filter"><label for="summary-type">Period</label><select id="summary-type" name="type">${["weekly", "monthly", "yearly", "custom"].map((option) => `<option value="${option}" ${option === period.type ? "selected" : ""}>${option[0].toUpperCase() + option.slice(1)}</option>`).join("")}</select></div><div class="search-filter"><label for="summary-start">${period.type === "custom" ? "Start" : "Date in period"}</label><input id="summary-start" name="start" type="date" value="${period.type === "custom" ? period.start : anchor}"></div><div class="search-filter" id="summary-end-wrap" ${period.type === "custom" ? "" : "hidden"}><label for="summary-end">End</label><input id="summary-end" name="end" type="date" value="${period.end}"></div></div><button type="submit">Show period</button></form><section id="summary-block" class="summary"><div class="summary-heading"><div><p class="summary-kicker">${period.start} to ${period.end}</p><h2>${period.type[0].toUpperCase() + period.type.slice(1)} summary</h2></div>${current ? '<span class="summary-status">Ready</span>' : ""}</div>${current ? `<p class="muted summary-meta"><span>${current.engine}</span>${current.model ? `<span> · ${escapeHtml(current.model)}</span>` : ""}${current.editedMarkdown ? '<span class="pill">edited</span>' : ""}</p><div class="prose">${renderMarkdown(current.editedMarkdown ?? current.generatedMarkdown)}</div><details class="summary-edit"><summary>Edit</summary><form id="summary-edit-form"><textarea name="text" rows="10">${escapeHtml(current.editedMarkdown ?? current.generatedMarkdown)}</textarea><p class="hint">Your edit is stored separately from regenerated text.</p><button type="submit">Save</button></form></details><button type="button" class="linklike" id="generate-summary">Write it again</button>` : '<p class="muted">No summary for this period yet. Rule-based generation works entirely offline.</p><button type="button" id="generate-summary">Write it</button>'}<p class="notice error" id="summary-error" hidden></p></section>${stored.length > (current ? 1 : 0) ? `<section class="summary-history-section"><div class="summary-history-head"><div><h2>Previous summaries</h2></div><span class="summary-history-count">${stored.length - (current ? 1 : 0)}</span></div><div class="summary-history-list">${stored.filter((summary) => summary.id !== current?.id).map((summary) => `<div class="summary-history-item"><div class="summary-history-summary"><div class="summary-history-copy"><strong>${summary.periodStart} to ${summary.periodEnd}</strong><span>${summary.type} · ${summary.engine} · ${summary.noteCount} notes</span></div></div></div>`).join("")}</div></section>` : ""}`;
  const periodForm = requireElement<HTMLFormElement>("#summary-period-form"); requireElement<HTMLSelectElement>("#summary-type").addEventListener("change", (event) => { requireElement<HTMLElement>("#summary-end-wrap").hidden = (event.currentTarget as HTMLSelectElement).value !== "custom"; }); periodForm.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(periodForm); const next = new URLSearchParams({ type: data.get("type")?.toString() ?? "weekly", start: data.get("start")?.toString() ?? isoDate(new Date()) }); if (data.get("type") === "custom") next.set("end", data.get("end")?.toString() ?? ""); history.replaceState({}, "", appUrl(`/summaries?${next}`)); void renderRoute(); });
  requireElement<HTMLButtonElement>("#generate-summary").addEventListener("click", async (event) => { const button = event.currentTarget as HTMLButtonElement; button.disabled = true; const settings = await settingsRepository.get<OllamaSettings>("ollama") ?? DEFAULT_OLLAMA_SETTINGS; const source = allNotes.filter((note) => note.noteDate >= period.start && note.noteDate <= period.end); const engine = settings.enabled ? new OllamaSummaryEngine(settings) : new RuleBasedSummaryEngine(); try { const result = await summaries.generate(source, period, engine); if (result.fallbackError) sessionStorage.setItem("summary-fallback", result.fallbackError); if (result.summary.engine === "ollama") void track("ai_summary_used"); await renderRoute(); } catch (error) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = errorMessage(error); button.disabled = false; } });
  const fallback = sessionStorage.getItem("summary-fallback"); if (fallback) { const message = requireElement<HTMLElement>("#summary-error"); message.hidden = false; message.textContent = s.ollamaFallbackNotice(fallback); sessionStorage.removeItem("summary-fallback"); }
  const editForm = document.querySelector<HTMLFormElement>("#summary-edit-form"); editForm?.addEventListener("submit", async (event) => { event.preventDefault(); if (!current) return; await summaries.edit(current.id, new FormData(editForm).get("text")?.toString() ?? ""); await renderRoute(); });
}

export async function renderSummariesV2(content: HTMLElement): Promise<void> {
  const isOllamaEnabled = false;
  const params = new URLSearchParams(location.search);
  const type = (["weekly", "monthly", "custom"].includes(params.get("type") ?? "") ? params.get("type") : "weekly") as "weekly" | "monthly" | "custom";
  const anchor = validIsoDate(params.get("start")) ? params.get("start") as string : isoDate(new Date());
  const end = validIsoDate(params.get("end")) ? params.get("end") as string : anchor;
  const mode: "rule-based" | "ollama" = "rule-based";

  let period;
  try {
    period = summaryPeriod(type, anchor, end);
  } catch {
    period = summaryPeriod("weekly", isoDate(new Date()));
  }

  const stored = await summaries.list();
  const allNotes = await notes.listAll();
  const source = allNotes.filter((note) => note.noteDate >= period.start && note.noteDate <= period.end && !note.archived);
  const current = stored.find((summary) => summary.id === `${period.type}:${period.start}:${period.end}`);
  const range = `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
  const shownMarkdown = current?.editedMarkdown ?? current?.generatedMarkdown;
  const s = currentStrings();

  const summaryKey = `${period.type}:${period.start}:${period.end}`;
  if (summaryKey !== lastOpenedSummaryPeriodKey) {
    lastOpenedSummaryPeriodKey = summaryKey;
    if (period.type === "weekly") {
      void track("weekly_summary_opened");
    } else if (period.type === "monthly") {
      void track("monthly_summary_opened");
    }
  }

  document.title = `${s.summariesTitle} · Rook Lite`;

  content.innerHTML = `<div class="summaries-page"><header class="page-head"><div><h1>${s.summariesTitle}</h1><p class="lede">${s.summariesLede}</p></div></header><form id="summary-period-form" class="summary-control-panel"><div class="summary-toolbar-row"><div class="summary-period-tabs" role="tablist" aria-label="${s.summaryPeriodAria}">${[["weekly", s.thisWeek], ["monthly", s.thisMonth], ["custom", s.customRange]].map(([value, label]) => `<button type="button" role="tab" data-summary-type="${value}" class="${type === value ? "is-active" : ""}" aria-pressed="${type === value}" aria-selected="${type === value}">${label}</button>`).join("")}</div><input type="hidden" name="type" value="${type}"><div class="summary-date-fields ${type === "custom" ? "is-custom" : ""}" role="group" aria-label="${s.dateRange}"><label class="summary-date-label" title="${type === "custom" ? s.startDate : s.dateInPeriod}"><span class="summary-date-text">${type === "custom" ? s.startDate : s.dateInPeriod}</span><input name="start" type="date" aria-label="${type === "custom" ? s.startDate : s.dateInPeriod}" value="${type === "custom" ? period.start : anchor}"></label>${type === "custom" ? `<span class="summary-date-sep" aria-hidden="true">→</span>` : ""}<label class="summary-date-label summary-end-field" ${type === "custom" ? "" : "hidden"} title="${s.endDate}"><span class="summary-date-text">${s.endDate}</span><input name="end" type="date" aria-label="${s.endDate}" value="${period.end}"></label></div><div class="summary-mode-picker" role="radiogroup" aria-label="${s.summaryMode}"><label class="mode-tab is-active" title="${escapeHtml(s.modeRuleBasedDesc)}"><input type="radio" name="mode" value="rule-based" checked><span>${s.modeRuleBased}</span></label><label class="mode-tab is-disabled" title="${escapeHtml(s.modeOllamaDisabledDesc)}" aria-disabled="true"><input type="radio" name="mode" value="ollama" disabled><span>${s.modeOllama}</span></label></div></div></form><section class="summary-document" aria-labelledby="summary-document-title"><header><div><p>${source.length} ${source.length === 1 ? s.entrySingle : s.entryPlural} · ${range}</p><h2 id="summary-document-title">${type === "weekly" ? s.weekLabel(isoWeek(new Date(`${period.start}T12:00:00`))) : type === "monthly" ? formatMonthYear(new Date(`${period.start}T12:00:00`)) : s.customRange}</h2></div><div class="summary-document-actions">${shownMarkdown ? `<button type="button" class="secondary-button" id="copy-summary">${s.copySummary}</button><button type="button" class="secondary-button" id="export-summary">${s.exportSummary}</button>` : ""}<button type="button" id="generate-summary">${current ? s.regenerateSummary : s.generateSummary}</button></div></header><p id="summary-error" class="notice error" hidden aria-live="polite"></p>${shownMarkdown ? `<div class="summary-prose prose">${renderMarkdown(shownMarkdown)}</div>${current ? `<details class="summary-edit"><summary>${s.editMarkdown}</summary><form id="summary-edit-form"><textarea name="text" rows="12">${escapeHtml(current.editedMarkdown ?? current.generatedMarkdown)}</textarea><button type="submit">${s.saveChanges}</button></form></details>` : ""}` : `<div class="summary-empty"><img src="${assetUrl("/logo.png")}" alt="" width="48" height="48"><h3>${s.noSummaryYet}</h3><p>${s.noSummaryYetDesc(source.length > 0)}</p></div>`}</section></div>`;
  const form = requireElement<HTMLFormElement>("#summary-period-form");
  form.querySelectorAll<HTMLButtonElement>("[data-summary-type]").forEach((button) => button.addEventListener("click", () => {
    const nextType = button.dataset.summaryType ?? "weekly";
    const next = new URLSearchParams({ type: nextType, start: isoDate(new Date()), mode });
    if (nextType === "custom") next.set("end", isoDate(new Date()));
    history.replaceState({}, "", appUrl(`/summaries?${next}`));
    void renderRoute();
  }));
  const navigate = () => {
    const data = new FormData(form);
    const selectedMode = data.get("mode")?.toString() ?? "rule-based";
    const nextMode = selectedMode === "ollama" && !isOllamaEnabled ? "rule-based" : selectedMode;
    const next = new URLSearchParams({ type: data.get("type")?.toString() ?? "weekly", start: data.get("start")?.toString() ?? isoDate(new Date()), mode: nextMode });
    if (data.get("type") === "custom") next.set("end", data.get("end")?.toString() ?? "");
    history.replaceState({}, "", appUrl(`/summaries?${next}`));
    void renderRoute();
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); navigate(); });
  form.querySelectorAll<HTMLInputElement>('input[type="date"], input[name="mode"]').forEach((input) => input.addEventListener("change", navigate));
  document.querySelector<HTMLButtonElement>("#generate-summary")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    button.textContent = s.generatingSummary;
    const engine = new RuleBasedSummaryEngine();
    try {
      const result = await summaries.generate(source, period, engine);
      if (result.fallbackError) sessionStorage.setItem("summary-fallback", result.fallbackError);
      if (result.summary.engine === "ollama") void track("ai_summary_used");
      await renderRoute();
    } catch (error) {
      const message = requireElement<HTMLElement>("#summary-error");
      message.hidden = false;
      message.textContent = errorMessage(error);
      button.disabled = false;
      button.textContent = current ? s.regenerateSummary : s.generateSummary;
    }
  });
  const fallback = sessionStorage.getItem("summary-fallback");
  if (fallback) {
    const message = requireElement<HTMLElement>("#summary-error");
    message.hidden = false;
    message.textContent = s.ollamaFallbackNotice(fallback);
    sessionStorage.removeItem("summary-fallback");
  }
  document.querySelector<HTMLButtonElement>("#copy-summary")?.addEventListener("click", async () => { if (shownMarkdown) await navigator.clipboard.writeText(shownMarkdown); });
  document.querySelector<HTMLButtonElement>("#export-summary")?.addEventListener("click", () => { if (shownMarkdown) downloadBlob(new Blob([shownMarkdown], { type: "text/markdown" }), `rook-summary-${period.start}-${period.end}.md`); });
  document.querySelector<HTMLFormElement>("#summary-edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!current) return;
    const editForm = event.currentTarget as HTMLFormElement;
    await summaries.edit(current.id, new FormData(editForm).get("text")?.toString() ?? "");
    await renderRoute();
  });
}

export async function renderData(content: HTMLElement): Promise<void> {
  history.replaceState({}, "", appUrl("/settings#data-management-section"));
  await renderSettings(content);
}

export async function renderSettings(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const counts = await storageCounts();
  const allNotes = await notes.listAll();
  const lastExport = await settingsRepository.get<string>("lastExportAt");
  const analyticsEnabled = await isAnalyticsEnabled();
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

    <div class="settings-streamlined-stack">
      <section class="settings-section">
        <h2 class="settings-section-title">${s.appearanceTitle}</h2>
        
        <div class="settings-row">
          <div class="settings-row-info">
            <span class="settings-row-label">${s.appearanceTitle}</span>
            <span class="settings-row-desc">${s.appearanceSubtitle}</span>
          </div>
          <div class="settings-segmented-control" role="radiogroup" aria-label="${s.appearanceTitle}">
            ${([
              ["SYSTEM", s.themeSystem, icons.monitor],
              ["LIGHT", s.themeLight, icons.sun],
              ["DARK", s.themeDark, icons.moon]
            ] as const).map(([val, label, iconSvg]) => `
              <label class="settings-segmented-btn ${currentTheme === val ? "is-active" : ""}">
                <input type="radio" name="settings-theme" value="${val}" ${currentTheme === val ? "checked" : ""} class="visually-hidden">
                ${svg(iconSvg, "settings-segmented-icon")}
                <span>${label}</span>
              </label>
            `).join("")}
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <span class="settings-row-label">${s.languageTitle}</span>
            <span class="settings-row-desc">${s.languageSubtitle}</span>
          </div>
          <div class="settings-segmented-control" role="radiogroup" aria-label="${s.languageTitle}">
            ${getAvailableLocales().map((loc) => `
              <label class="settings-segmented-btn ${currentLocale === loc.code ? "is-active" : ""}">
                <input type="radio" name="settings-language" value="${loc.code}" ${currentLocale === loc.code ? "checked" : ""} class="visually-hidden">
                <span>${escapeHtml(loc.label)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      </section>

      <section class="settings-section local-ai-card is-collapsed is-disabled">
        <div class="settings-row settings-toggle-row">
          <div class="settings-row-info">
            <div class="title-with-badge">
              <span class="settings-row-label">${s.localAiTitle}</span>
              <span class="ai-privacy-pill">${s.localAiBadge}</span>
            </div>
            <span class="settings-row-desc">${s.localAiDisabledDesc}</span>
          </div>
          <div class="ai-toggle-wrapper">
            <label class="toggle-switch is-disabled" for="ollama-enabled-toggle" title="${s.localAiDisabledTitle}">
              <input type="checkbox" id="ollama-enabled-toggle" disabled aria-disabled="true">
              <span class="toggle-slider"></span>
              <span class="visually-hidden">${s.localAiTitle}</span>
            </label>
          </div>
        </div>

        <div id="ollama-config-panel" class="ai-config-panel" hidden>
          <form id="ollama-form" class="settings-form" onsubmit="return false;">
            <div class="form-row">
              <div class="form-field flex-2">
                <label for="ollama-endpoint">${s.ollamaEndpointLabel}</label>
                <input class="form-input" id="ollama-endpoint" name="endpoint" value="${escapeHtml(ollama.endpoint)}" placeholder="http://localhost:11434" disabled readonly>
                <span class="field-hint">${s.ollamaEndpointHint}</span>
              </div>
              <div class="form-field flex-2">
                <label for="ollama-model">${s.ollamaModelLabel}</label>
                <div class="model-select-wrapper">
                  <select class="form-input" id="ollama-model" name="model" disabled>
                    <option value="${escapeHtml(ollama.model)}">${escapeHtml(ollama.model)}</option>
                  </select>
                </div>
                <span class="field-hint">${s.ollamaModelHint}</span>
              </div>
            </div>

            <details class="advanced-prompt-disclosure">
              <summary class="advanced-prompt-summary">
                <span class="advanced-prompt-title">Advanced options (Temperature & Prompt)</span>
                ${svg(icons.chevronDown, "disclosure-chevron-svg")}
              </summary>
              <div class="advanced-prompt-body">
                <div class="form-field flex-1">
                  <div class="field-label-row">
                    <label for="ollama-temperature">${s.ollamaTempLabel}</label>
                    <span id="temp-val-display" class="temp-badge">${Number(ollama.temperature).toFixed(2)}</span>
                  </div>
                  <input type="range" id="ollama-temperature" name="temperature" min="0" max="1" step="0.05" value="${ollama.temperature}" class="range-slider" disabled>
                  <div class="range-labels">
                    <span>${s.ollamaTempPrecise}</span>
                    <span>${s.ollamaTempBalanced}</span>
                    <span>${s.ollamaTempCreative}</span>
                  </div>
                </div>

                <div class="form-field flex-1">
                  <div class="field-label-row">
                    <label for="ollama-system-prompt">${s.ollamaSystemPromptLabel}</label>
                    <button type="button" id="reset-ollama-prompt" class="text-link-btn" title="${s.resetToDefault}" disabled>${s.resetToDefault}</button>
                  </div>
                  <textarea class="form-textarea" id="ollama-system-prompt" name="systemPrompt" rows="3" placeholder="${s.ollamaSystemPromptHint}" disabled readonly>${escapeHtml(ollama.systemPrompt ?? DEFAULT_OLLAMA_PROMPT)}</textarea>
                  <span class="field-hint">${s.ollamaSystemPromptHint}</span>
                </div>
              </div>
            </details>

            <div class="ai-actions-row">
              <button type="button" id="test-ollama" class="secondary-button icon-action-btn" title="${s.testConnectionBtn}" aria-label="${s.testConnectionBtn}" disabled>${svg(icons.refresh, "btn-action-icon")}<span class="visually-hidden">${s.testConnectionBtn}</span></button>
              <button type="submit" class="save-btn-rect icon-action-btn" title="${s.saveAiSettingsBtn}" aria-label="${s.saveAiSettingsBtn}" disabled>${svg(icons.check, "btn-action-icon")}<span class="visually-hidden">${s.saveAiSettingsBtn}</span></button>
            </div>
            <div id="ollama-status" class="notice" hidden aria-live="polite"></div>
          </form>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="settings-section-title">${s.storageTitle}</h2>
        
        <div class="settings-row">
          <div class="settings-row-info">
            <span class="settings-row-label">${s.storageTitle}</span>
            <span class="settings-row-desc">${counts.notes} ${counts.notes === 1 ? s.entrySingle : s.entryPlural} · ${counts.summaries} ${s.navSummaries.toLowerCase()}${estimate?.usage ? ` · ${formatBytes(estimate.usage)}` : ""}</span>
          </div>
          <div class="settings-row-action">
            ${persisted ? `<span class="persistence-status-badge">✓ ${s.persistencePersisted}</span>` : `<button type="button" id="request-persistence" class="secondary-button icon-action-btn" title="${s.requestPersistenceBtn}" aria-label="${s.requestPersistenceBtn}">${svg(icons.shield, "btn-action-icon")}<span class="visually-hidden">${s.requestPersistenceBtn}</span></button>`}
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <span class="settings-row-label">${s.keyboardShortcutsTitle}</span>
            <span class="settings-row-desc">${s.keyboardShortcutsDesc}</span>
          </div>
          <div class="settings-row-action">
            <button type="button" data-action="open-shortcuts" class="secondary-button icon-action-btn" title="${s.viewShortcuts} (?)" aria-label="${s.viewShortcuts}">${svg(icons.keyboard, "btn-action-icon")}<span class="visually-hidden">${s.viewShortcuts}</span></button>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <div class="title-with-badge">
              <span class="settings-row-label">${s.aboutTitle}</span>
              <span class="version-badge">v${APP_VERSION}</span>
            </div>
            <span class="settings-row-desc">Rook Lite v${APP_VERSION} · ${s.aboutSubtitle}</span>
          </div>
          <div class="settings-row-action">
            <a href="https://github.com/volkanto/rook-lite" target="_blank" rel="noopener noreferrer" class="secondary-button icon-action-btn" title="GitHub" aria-label="GitHub">${svg(icons.github, "btn-action-icon")}<span class="visually-hidden">GitHub</span></a>
          </div>
        </div>
      </section>

      <section class="settings-section" id="privacy-section">
        <h2 class="settings-section-title">${s.privacyTitle}</h2>

        <div class="settings-row settings-toggle-row">
          <div class="settings-row-info">
            <div class="title-with-badge">
              <span class="settings-row-label">${s.analyticsTitle}</span>
              <span class="ai-privacy-pill" id="analytics-status-pill">${analyticsEnabled ? s.analyticsStatusEnabled : s.analyticsStatusDisabled}</span>
            </div>
            <span class="settings-row-desc">${s.analyticsSubtitle}</span>
            <div class="analytics-privacy-details">
              <span class="analytics-privacy-heading">${s.analyticsNeverCollectedTitle}:</span>
              <ul class="analytics-never-collected-list">
                <li>${s.analyticsNeverNoteContents}</li>
                <li>${s.analyticsNeverNoteTitles}</li>
                <li>${s.analyticsNeverTags}</li>
                <li>${s.analyticsNeverSearches}</li>
                <li>${s.analyticsNeverAi}</li>
                <li>${s.analyticsNeverIdentifiers}</li>
              </ul>
            </div>
          </div>
          <div class="settings-row-action">
            <label class="toggle-switch" for="analytics-enabled-toggle" title="${s.analyticsTitle}">
              <input type="checkbox" id="analytics-enabled-toggle" ${analyticsEnabled ? "checked" : ""}>
              <span class="toggle-slider"></span>
              <span class="visually-hidden">${s.analyticsTitle}</span>
            </label>
          </div>
        </div>
      </section>

      <section class="settings-section" id="data-management-section">
        <h2 class="settings-section-title">${s.dataManagementTitle}</h2>

        <div class="settings-row">
          <div class="settings-row-info">
            <span class="settings-row-label">${s.markdownExportTitle}</span>
            <span class="settings-row-desc">${s.markdownExportSubtitle}</span>
            <span class="hint">${lastExport ? `${s.lastExportPrefix} ${escapeHtml(new Date(lastExport).toLocaleString(getLocale() === "tr" ? "tr-TR" : "en-US"))}` : s.noExportYet}</span>
          </div>
          <div class="settings-row-action">
            <button type="button" id="directory-export" class="secondary-button" ${allNotes.length ? "" : "disabled"} title="${s.chooseExportFolderBtn}">${s.chooseExportFolderBtn}</button>
            <button type="button" id="zip-export" class="secondary-button" ${allNotes.length ? "" : "disabled"} title="${s.downloadZipBtn}">${s.downloadZipBtn}</button>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <span class="settings-row-label">${s.fullBackupTitle}</span>
            <span class="settings-row-desc">${s.fullBackupSubtitle}</span>
          </div>
          <div class="settings-row-action">
            <button type="button" id="create-backup" class="secondary-button" title="${s.createJsonBackupBtn}">${s.createJsonBackupBtn}</button>
            <label class="save-btn-rect lite-file-label" for="restore-backup">${s.restoreJsonBackupLabel}</label>
            <input class="visually-hidden" type="file" id="restore-backup" accept="application/json,.json">
          </div>
        </div>
        <p id="data-message" class="notice" hidden></p>
      </section>

      <section class="settings-section danger-section">
        <div class="settings-row">
          <div class="settings-row-info">
            <span class="settings-row-label danger-title">${s.dangerZoneTitle}</span>
            <span class="settings-row-desc">${s.dangerZoneSubtitle}</span>
          </div>
          <div class="settings-row-action">
            <button type="button" id="delete-local-data" class="danger-save-btn icon-action-btn" title="${s.clearAllDataBtn}" aria-label="${s.clearAllDataBtn}">${svg(icons.trash, "btn-action-icon")}<span class="visually-hidden">${s.clearAllDataBtn}</span></button>
          </div>
        </div>
      </section>
    </div>
  </div>`;
  bindSettingsEvents(content);
}

function bindSettingsEvents(content: HTMLElement): void {
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
      const control = input.closest(".settings-segmented-control");
      control?.querySelectorAll(".settings-segmented-btn").forEach((btn) => {
        const isMatch = (btn.querySelector("input") as HTMLInputElement)?.value === input.value;
        btn.classList.toggle("is-active", isMatch);
      });
    });
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

  const loadModels = async (announce = false): Promise<string[]> => {
    const statusEl = content.querySelector<HTMLElement>("#ollama-status");
    const endpointInput = content.querySelector<HTMLInputElement>("#ollama-endpoint");
    const current = (await settingsRepository.get<OllamaSettings>("ollama")) ?? DEFAULT_OLLAMA_SETTINGS;
    const endpoint = endpointInput?.value.trim() || current.endpoint;

    if (announce && statusEl) {
      statusEl.hidden = false;
      statusEl.className = "notice";
      statusEl.textContent = s.testingConnection;
    }

    try {
      const models = await testOllama({ ...current, endpoint });
      const select = content.querySelector<HTMLSelectElement>("#ollama-model");
      if (select && models.length > 0) {
        const selected = select.value || current.model;
        select.innerHTML = models
          .map((m: string) => `<option value="${escapeHtml(m)}" ${m === selected ? "selected" : ""}>${escapeHtml(m)}</option>`)
          .join("");
        if (!models.includes(selected) && selected) {
          select.insertAdjacentHTML("afterbegin", `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`);
        }
      }
      if (announce && statusEl) {
        statusEl.className = "notice success";
        statusEl.textContent = models.length ? s.connectedModelsFound(models.length) : s.connectedNoModels;
      }
      return models;
    } catch (err) {
      if (announce && statusEl) {
        statusEl.className = "notice error";
        statusEl.textContent = errorMessage(err);
      }
      return [];
    }
  };

  const ollamaToggle = content.querySelector<HTMLInputElement>("#ollama-enabled-toggle");
  ollamaToggle?.addEventListener("change", async () => {
    const current = (await settingsRepository.get<OllamaSettings>("ollama")) ?? DEFAULT_OLLAMA_SETTINGS;
    const isEnabled = ollamaToggle.checked;
    await settingsRepository.set("ollama", { ...current, enabled: isEnabled });
    const configPanel = content.querySelector<HTMLElement>("#ollama-config-panel");
    if (configPanel) configPanel.hidden = !isEnabled;
    const card = ollamaToggle.closest(".local-ai-card");
    card?.classList.toggle("is-collapsed", !isEnabled);
    if (isEnabled) {
      void loadModels(false);
    }
  });

  const tempSlider = content.querySelector<HTMLInputElement>("#ollama-temperature");
  const tempDisplay = content.querySelector<HTMLElement>("#temp-val-display");
  tempSlider?.addEventListener("input", () => {
    if (tempDisplay) tempDisplay.textContent = Number(tempSlider.value).toFixed(2);
  });

  content.querySelector<HTMLButtonElement>("#reset-ollama-prompt")?.addEventListener("click", () => {
    const promptArea = content.querySelector<HTMLTextAreaElement>("#ollama-system-prompt");
    if (promptArea) promptArea.value = DEFAULT_OLLAMA_PROMPT;
  });

  const ollamaForm = content.querySelector<HTMLFormElement>("#ollama-form");
  ollamaForm?.addEventListener("submit", async () => {
    const current = (await settingsRepository.get<OllamaSettings>("ollama")) ?? DEFAULT_OLLAMA_SETTINGS;
    const data = new FormData(ollamaForm);
    const updated: OllamaSettings = {
      ...current,
      endpoint: data.get("endpoint")?.toString().trim() || "http://localhost:11434",
      model: data.get("model")?.toString().trim() || "llama3.2",
      temperature: Number(data.get("temperature")) || 0.2,
      systemPrompt: data.get("systemPrompt")?.toString() || DEFAULT_OLLAMA_PROMPT
    };
    await settingsRepository.set("ollama", updated);
    const statusEl = content.querySelector<HTMLElement>("#ollama-status");
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.className = "notice success";
      statusEl.textContent = s.aiSettingsSaved;
      window.setTimeout(() => { statusEl.hidden = true; }, 3000);
    }
  });

  content.querySelector<HTMLButtonElement>("#test-ollama")?.addEventListener("click", async () => {
    await loadModels(true);
  });

  if (ollamaToggle?.checked) {
    void loadModels(false);
  }

  const analyticsToggle = content.querySelector<HTMLInputElement>("#analytics-enabled-toggle");
  analyticsToggle?.addEventListener("change", async () => {
    const isEnabled = analyticsToggle.checked;
    await setAnalyticsEnabled(isEnabled);
    const pill = content.querySelector<HTMLElement>("#analytics-status-pill");
    if (pill) {
      pill.textContent = isEnabled ? s.analyticsStatusEnabled : s.analyticsStatusDisabled;
    }
  });

  content.querySelector<HTMLButtonElement>("#zip-export")?.addEventListener("click", () => {
    void notes.listAll().then((allN) => {
      downloadMarkdownZip(allN);
      void track("markdown_exported");
    });
  });
  content.querySelector<HTMLButtonElement>("#directory-export")?.addEventListener("click", async () => {
    try {
      const allN = await notes.listAll();
      const count = await exportToDirectory(allN);
      void track("markdown_exported");
      dataMessage(s.exportedNotesCount(count), false);
    } catch (error) {
      dataMessage(errorMessage(error), true);
    }
  });
  content.querySelector<HTMLButtonElement>("#create-backup")?.addEventListener("click", async () => {
    downloadJson(await createBackup());
    void track("backup_exported");
  });
  content.querySelector<HTMLInputElement>("#restore-backup")?.addEventListener("change", async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      showConfirm(
        s.replaceDataTitle,
        s.replaceDataMessage(backup.notes.length, backup.summaries.length),
        s.restoreBackupBtn,
        async () => {
          await restoreBackup(backup);
          void track("backup_imported");
          await refreshCalendar();
          await renderRoute();
        }
      );
    } catch (error) {
      dataMessage(errorMessage(error), true);
    }
  });

  content.querySelector<HTMLButtonElement>("#delete-local-data")?.addEventListener("click", () =>
    showConfirm(
      s.clearConfirmTitle,
      s.clearConfirmMessage,
      s.clearAllAction,
      async () => {
        await clearAllData();
        localStorage.removeItem("theme-preference");
        sessionStorage.clear();
        await refreshCalendar();
        await renderRoute();
      }
    )
  );
}

function dataMessage(message: string, error: boolean): void {
  const element = document.querySelector<HTMLElement>("#data-message");
  if (!element) return;
  element.hidden = false;
  element.textContent = message;
  element.classList.toggle("error", error);
}
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export async function showLinkPickerModal(textarea: HTMLTextAreaElement): Promise<void> {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.slice(start, end).trim();

  let currentQuery = selectedText;
  let activeIndex = 0;
  let allNotes: Note[] = [];

  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop link-picker-backdrop";
  backdrop.id = "link-picker-backdrop";
  backdrop.innerHTML = `
    <section class="link-picker-dialog" role="dialog" aria-modal="true" aria-label="${s.insertWikilink}">
      <header class="link-picker-header">
        <div class="link-picker-search-field">
          <span class="link-picker-search-icon" aria-hidden="true">${svg(icons.search, "picker-search-svg")}</span>
          <input type="text" class="link-picker-input" id="link-picker-search" placeholder="${s.searchPlaceholder}" autocomplete="off" spellcheck="false" value="${escapeHtml(selectedText)}" aria-label="${s.insertWikilink}">
          <button type="button" class="link-picker-esc-hint" data-close-dialog aria-label="${s.closeEditor}" title="${s.closeEditor} (Esc)">esc</button>
        </div>
      </header>
      <div class="link-picker-results" id="link-picker-results" role="listbox"></div>
      <footer class="link-picker-footer">
        <span class="link-picker-hint">${s.pickerNavHint}</span>
      </footer>
    </section>
  `;

  host.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const searchInput = backdrop.querySelector<HTMLInputElement>("#link-picker-search")!;
  const resultsContainer = backdrop.querySelector<HTMLElement>("#link-picker-results")!;

  const closePicker = () => {
    window.removeEventListener("keydown", onKeydown);
    closeDialog(backdrop);
    textarea.focus();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePicker();
    }
  };
  window.addEventListener("keydown", onKeydown);

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
    }
  });

  const pickerLabels = {
    todayBadge: s.badgeToday,
    yesterdayBadge: s.badgeYesterday,
    dateBadge: s.badgeDate,
    todayLabel: s.today,
    yesterdayLabel: s.yesterday,
    emptyNoteLabel: s.emptyNote
  };

  function renderList(): void {
    const { dates, notes: candidateNotes } = getLinkPickerCandidates(currentQuery, allNotes, 30, pickerLabels);
    const totalItems = [...dates, ...candidateNotes];

    if (totalItems.length === 0) {
      resultsContainer.innerHTML = `<div class="link-picker-empty"><p>${s.searchNoResults}</p></div>`;
      return;
    }

    if (activeIndex >= totalItems.length) activeIndex = 0;

    let html = "";
    let itemIdx = 0;

    if (dates.length > 0) {
      html += `<div class="link-picker-section-label">${escapeHtml(s.pickerSectionDates)}</div>`;
      for (const d of dates) {
        const isSelected = itemIdx === activeIndex;
        html += `
          <button type="button" class="link-picker-row ${isSelected ? "is-selected" : ""}" data-item-idx="${itemIdx}" data-target="${escapeHtml(d.target)}" role="option" aria-selected="${isSelected}">
            <span class="link-picker-row-badge is-date">${escapeHtml(d.badge)}</span>
            <span class="link-picker-row-text prose">${renderInlineMarkdown(d.line)}</span>
          </button>
        `;
        itemIdx++;
      }
    }

    if (candidateNotes.length > 0) {
      html += `<div class="link-picker-section-label">${escapeHtml(s.pickerSectionNotes)}</div>`;
      for (const n of candidateNotes) {
        const isSelected = itemIdx === activeIndex;
        html += `
          <button type="button" class="link-picker-row ${isSelected ? "is-selected" : ""}" data-item-idx="${itemIdx}" data-target="${escapeHtml(n.target)}" role="option" aria-selected="${isSelected}">
            <span class="link-picker-row-badge">${escapeHtml(n.badge)}</span>
            <span class="link-picker-row-text prose">${renderInlineMarkdown(n.line)}</span>
            ${n.tag ? `<span class="link-picker-row-tag">#${escapeHtml(n.tag)}</span>` : ""}
          </button>
        `;
        itemIdx++;
      }
    }

    resultsContainer.innerHTML = html;

    resultsContainer.querySelectorAll<HTMLButtonElement>(".link-picker-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target ?? "";
        applyLinkInsertion(target);
      });
    });

    const activeEl = resultsContainer.querySelector<HTMLElement>(".link-picker-row.is-selected");
    if (typeof activeEl?.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }

  function applyLinkInsertion(target: string): void {
    const syntax = `${buildWikilinkInsertion(target, selectedText)} `;
    textarea.setRangeText(syntax, start, end, "end");
    closePicker();
    resizeEditor(textarea);
    const form = textarea.closest("form");
    if (form) {
      updateEditorWordCount(form);
      form.classList.add("has-content");
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  searchInput.addEventListener("input", () => {
    currentQuery = searchInput.value;
    activeIndex = 0;
    renderList();
  });

  searchInput.addEventListener("keydown", (e) => {
    const { dates, notes: candidateNotes } = getLinkPickerCandidates(currentQuery, allNotes, 30, pickerLabels);
    const totalItems = [...dates, ...candidateNotes];
    if (totalItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % totalItems.length;
      renderList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + totalItems.length) % totalItems.length;
      renderList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = totalItems[activeIndex];
      if (selected) applyLinkInsertion(selected.target);
    }
  });

  allNotes = await notes.listAll();
  setWikilinkNotesIndex(allNotes);
  renderList();
  requestAnimationFrame(() => {
    searchInput.focus();
    searchInput.select();
  });
}

function showConfirm(title: string, message: string, actionLabel: string, action: () => Promise<void>): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop confirm-backdrop";
  backdrop.id = "confirm-backdrop";
  backdrop.innerHTML = `<section class="note-edit-dialog lite-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><header class="note-edit-dialog-head"><div class="confirm-title-group"><span class="confirm-alert-icon-wrap" aria-hidden="true">${svg(icons.alert, "confirm-alert-svg")}</span><h2 id="confirm-title">${escapeHtml(title)}</h2></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}">${svg(icons.close, "dialog-close-svg")}</button></header><div class="confirm-dialog-body"><p class="confirm-dialog-message">${escapeHtml(message)}</p></div><footer class="confirm-dialog-footer"><button type="button" class="btn-secondary" data-close-dialog>${s.cancel}</button><button type="button" class="btn-danger-confirm" id="confirm-action">${escapeHtml(actionLabel)}</button></footer></section>`;
  host.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const closeConfirm = () => {
    window.removeEventListener("keydown", onKeydown);
    closeDialog(backdrop);
  };

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      event.preventDefault();
      event.stopPropagation();
      closeConfirm();
    }
  });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeConfirm();
    }
  };
  window.addEventListener("keydown", onKeydown);

  backdrop.querySelector<HTMLButtonElement>("#confirm-action")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      await action();
      closeConfirm();
    } catch (error) {
      button.disabled = false;
      alert(errorMessage(error));
    }
  });
}

export function closeDialog(target?: Element | null): void {
  const host = document.querySelector<HTMLElement>("#dialog-host");
  if (!host) return;
  if (target !== undefined) {
    if (target && host.contains(target)) {
      const backdrop = target.classList.contains("note-edit-backdrop")
        ? target
        : target.closest(".note-edit-backdrop");
      if (backdrop) {
        backdrop.remove();
      } else {
        target.remove();
      }
    }
  } else if (host.lastElementChild) {
    host.lastElementChild.remove();
  } else {
    host.replaceChildren();
  }

  if (host.children.length === 0) {
    document.body.style.overflow = "";
    if (document.body.classList.contains("is-zen-mode")) {
      toggleZenMode();
    }
  }
}

export function closeAllDialogs(): void {
  const host = document.querySelector<HTMLElement>("#dialog-host");
  if (host) host.replaceChildren();
  document.body.style.overflow = "";
  if (document.body.classList.contains("is-zen-mode")) {
    toggleZenMode();
  }
}

export function updateScrollToTopVisibility(): void {
  const footer = document.querySelector<HTMLElement>(".notes-stream-footer");
  if (!footer) return;
  const notesList = document.querySelector<HTMLElement>(".notes-list");
  if (!notesList) {
    footer.classList.add("is-hidden");
    footer.setAttribute("hidden", "");
    return;
  }
  const shell = document.querySelector<HTMLElement>(".shell");
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const docOverflows = document.documentElement.scrollHeight > viewportHeight + 40;
  const shellOverflows = shell ? shell.scrollHeight > shell.clientHeight + 40 : false;
  const listRect = notesList.getBoundingClientRect();
  const listOverflows = listRect.bottom > viewportHeight + 40;
  const isScrollable = docOverflows || shellOverflows || listOverflows;

  if (isScrollable) {
    footer.classList.remove("is-hidden");
    footer.removeAttribute("hidden");
  } else {
    footer.classList.add("is-hidden");
    footer.setAttribute("hidden", "");
  }
}

function renderNotFound(content: HTMLElement): void {
  const s = currentStrings();
  document.title = `${s.notFoundTitle} · Rook Lite`;
  content.innerHTML = `<div class="page-head"><div><p class="eyebrow">${s.notFoundDesc}</p><h1>${s.notFoundTitle}</h1><p class="lede"><a href="${appUrl("/")}" data-link>${s.notFoundReturnHome}</a></p></div></div>`;
}

let shellEventsBound = false;

function bindShellEvents(): void {
  if (shellEventsBound) return;
  shellEventsBound = true;

  document.addEventListener("click", async (event) => {
    const target = event.target as Element;
    if (!target.closest(".editor-template-picker")) {
      document.querySelectorAll<HTMLDetailsElement>(".editor-template-picker[open]").forEach((details) => {
        details.removeAttribute("open");
      });
    }

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

    const modeBtn = target.closest<HTMLButtonElement>("[data-editor-mode]");
    if (modeBtn) {
      const form = modeBtn.closest("form");
      if (form) {
        const mode = modeBtn.dataset.editorMode as "write" | "preview" | undefined;
        if (mode === "write" || mode === "preview") {
          setEditorMode(form, mode, true);
        }
      }
      return;
    }

    const clickPath = event.composedPath();
    document.querySelectorAll<HTMLDetailsElement>(".date-picker[open], .note-action-menu[open], .sidebar-lang-picker[open]").forEach((details) => {
      if (!details.contains(target) && !clickPath.includes(details)) details.removeAttribute("open");
    });

    const clickedNote = target.closest<HTMLElement>(".note");
    if (clickedNote && !target.closest("button, a, input, details, summary")) {
      document.querySelectorAll(".note.is-selected").forEach((n) => {
        if (n !== clickedNote) n.classList.remove("is-selected");
      });
      clickedNote.classList.toggle("is-selected");
      if (clickedNote.classList.contains("is-selected")) {
        const id = clickedNote.id.replace(/^note-/, "");
        void notes.listAll().then((all) => {
          currentActiveNote = all.find((n) => n.id === id) ?? null;
        });
      } else {
        currentActiveNote = null;
      }
    } else if (!clickedNote && !target.closest("#search-modal, .command-palette")) {
      document.querySelectorAll(".note.is-selected").forEach((n) => n.classList.remove("is-selected"));
      currentActiveNote = null;
    }

    const langBtn = target.closest<HTMLButtonElement>("[data-select-lang]");
    if (langBtn) {
      const selected = langBtn.dataset.selectLang as SupportedLocale;
      if (selected && selected !== getLocale()) {
        setLocale(selected);
        void renderShell();
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
      closeAllDialogs();
      void renderRoute().then(() => {
        if (link.dataset.command === "new-note") {
          const form = document.querySelector<HTMLFormElement>("#new-note-form");
          if (form) setEditorMode(form, "write", false);
          document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus();
        }
      });
      return;
    }
    if (target.closest('[data-action="scroll-to-top"]')) {
      event.preventDefault();
      if (typeof window.scrollTo === "function") {
        window.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      }
      const shell = document.querySelector<HTMLElement>(".shell");
      if (typeof shell?.scrollTo === "function") {
        shell.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      }
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "open-shortcuts") {
      event.preventDefault();
      showShortcutsDialog();
      return;
    }
    if (action === "toggle-zen") {
      event.preventDefault();
      const form = target.closest<HTMLFormElement>("form") ?? undefined;
      toggleZenMode(form);
      return;
    }
    if (action === "toggle-sidebar") toggleSidebar();
    if (action === "close-sidebar") closeSidebar();
    if (action === "open-search") openSearch();
    if (action === "toggle-theme") setTheme(document.documentElement.dataset.theme === "dark" ? "LIGHT" : "DARK");
    const closeBtn = target.closest("[data-close-dialog]");
    if (closeBtn) {
      const backdrop = closeBtn.closest(".note-edit-backdrop");
      closeDialog(backdrop);
    }
    if (target.id === "search-modal") closeSearch();
  });
  window.addEventListener("popstate", () => {
    closeAllDialogs();
    void renderRoute();
  });
  window.addEventListener("resize", () => {
    closeSidebar();
    updateScrollToTopVisibility();
  });
  document.addEventListener("keydown", handleKeyboard);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
}

export function handleSmartListContinuation(event: KeyboardEvent, textarea: HTMLTextAreaElement): boolean {
  if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
    return false;
  }
  if (event.defaultPrevented) {
    return false;
  }

  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart !== selectionEnd) {
    return false;
  }

  const cursorPos = selectionStart;
  const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
  const nextNewline = value.indexOf("\n", cursorPos);
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;
  const currentLine = value.slice(lineStart, lineEnd);

  const taskMatch = currentLine.match(/^([ \t]*)([-*+])\s+\[[ xX]\](?:\s+|$)/);
  const bulletMatch = !taskMatch ? currentLine.match(/^([ \t]*)([-*+])\s+/) : null;
  const numberMatch = !taskMatch && !bulletMatch ? currentLine.match(/^([ \t]*)(\d+)\.\s+/) : null;

  if (!taskMatch && !bulletMatch && !numberMatch) {
    return false;
  }

  const prefix = (taskMatch ?? bulletMatch ?? numberMatch)![0];
  const prefixLength = prefix.length;

  if (cursorPos < lineStart + prefixLength) {
    return false;
  }

  const contentAfterPrefix = currentLine.slice(prefixLength).trim();
  if (contentAfterPrefix === "") {
    event.preventDefault();
    textarea.setRangeText("", lineStart, lineEnd, "end");
    textarea.setSelectionRange(lineStart, lineStart);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  let continuationPrefix = "";
  if (taskMatch) {
    const indent = taskMatch[1];
    const bullet = taskMatch[2];
    continuationPrefix = `\n${indent}${bullet} [ ] `;
  } else if (bulletMatch) {
    const indent = bulletMatch[1];
    const bullet = bulletMatch[2];
    continuationPrefix = `\n${indent}${bullet} `;
  } else if (numberMatch) {
    const indent = numberMatch[1];
    const nextNum = parseInt(numberMatch[2], 10) + 1;
    continuationPrefix = `\n${indent}${nextNum}. `;
  }

  event.preventDefault();
  const newPos = cursorPos + continuationPrefix.length;
  textarea.setRangeText(continuationPrefix, cursorPos, cursorPos, "end");
  textarea.setSelectionRange(newPos, newPos);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function bindFormatting(form: HTMLFormElement, textarea: HTMLTextAreaElement): void {
  form.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.format === "wikilink") {
        void showLinkPickerModal(textarea);
      } else {
        formatNote(textarea, button.dataset.format ?? "");
      }
    });
  });
  form.querySelectorAll<HTMLButtonElement>("[data-insert-template]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tmpl = getTemplateById(btn.dataset.insertTemplate ?? "");
      if (tmpl) {
        void insertTemplateIntoEditor(tmpl.markdown);
        btn.closest("details")?.removeAttribute("open");
      }
    });
  });
  textarea.addEventListener("keydown", (event) => {
    handleSmartListContinuation(event, textarea);
  });
}
function formatNote(textarea: HTMLTextAreaElement, style: string): void { const start = textarea.selectionStart; const end = textarea.selectionEnd; const selected = textarea.value.slice(start, end); const formats: Record<string, [string, string]> = { heading: ["### ", ""], bold: ["**", "**"], italic: ["_", "_"], strike: ["~~", "~~"], list: ["* ", ""], numbered: ["1. ", ""], task: ["- [ ] ", ""], code: ["```\n", "\n```"], wikilink: ["[[", "]]"], quote: ["> ", ""] }; const [rawPrefix, suffix] = formats[style] ?? ["", ""]; const before = textarea.value.slice(0, start); const prefix = ["heading", "list", "numbered", "task", "quote"].includes(style) && before && !before.endsWith("\n") ? `\n${rawPrefix}` : rawPrefix; textarea.setRangeText(`${prefix}${selected}${suffix}`, start, end, "end"); textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); textarea.dispatchEvent(new Event("input", { bubbles: true })); }
function resizeEditor(textarea: HTMLTextAreaElement): void {
  if (document.body.classList.contains("is-zen-mode")) {
    textarea.style.height = "";
    return;
  }
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}
function status(form: HTMLFormElement, message: string, error = false): void { const element = form.querySelector<HTMLElement>("[data-save-status]"); if (element) { element.textContent = message; element.classList.toggle("text-danger", error); } }
function setBusy(form: HTMLFormElement, busy: boolean): void { form.querySelectorAll<HTMLButtonElement>("button").forEach((button) => { button.disabled = busy; }); }
function handleKeyboard(event: KeyboardEvent): void {
  if (event.defaultPrevented) return;
  const modal = document.querySelector<HTMLElement>("#search-modal");
  if (modal?.classList.contains("is-open")) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
  }
  const active = document.activeElement?.tagName;
  const editing = active === "INPUT" || active === "TEXTAREA" || active === "SELECT";
  if (event.key === "/" && !editing) { event.preventDefault(); openSearch(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
  if (event.key === "?" && !editing) {
    event.preventDefault();
    showShortcutsDialog();
    return;
  }
  if ((event.key === "t" || event.key === "T") && !editing && appPath() === "/") {
    event.preventDefault();
    history.pushState({}, "", appUrl("/"));
    void renderRoute();
    return;
  }
  if (event.key.toLowerCase() === "n" && !editing) {
    event.preventDefault();
    if (appPath() !== "/") {
      history.pushState({}, "", appUrl("/"));
      void renderRoute().then(() => {
        const form = document.querySelector<HTMLFormElement>("#new-note-form");
        if (form) setEditorMode(form, "write", false);
        document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus();
      });
    } else {
      const form = document.querySelector<HTMLFormElement>("#new-note-form");
      if (form) setEditorMode(form, "write", false);
      document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")?.focus();
    }
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    const activeDialog = document.querySelector<HTMLFormElement>("#edit-note-form");
    const activeComposer = document.querySelector<HTMLFormElement>("#new-note-form");
    const target = (activeDialog && !activeDialog.closest(".is-hidden")) ? activeDialog : activeComposer ?? undefined;
    toggleZenMode(target);
    return;
  }
  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !editing && appPath() === "/") {
    const date = new URLSearchParams(location.search).get("date") ?? isoDate(new Date());
    history.pushState({}, "", appUrl(`/?date=${shiftDate(date, event.key === "ArrowLeft" ? -1 : 1)}`));
    void renderRoute();
  }
  if (event.key === "Escape") {
    if (document.body.classList.contains("is-zen-mode")) {
      event.preventDefault();
      toggleZenMode();
      return;
    }
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
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#121214" : "#F7F7FA");
  const toggle = document.querySelector<HTMLElement>(".sidebar-theme-toggle");
  if (toggle) {
    const nextLabel = resolved === "dark" ? s.themeToggleLight : s.themeToggleDark;
    toggle.setAttribute("aria-label", s.themeToggleAria);
    toggle.dataset.sidebarTooltip = nextLabel;
  }
}
export async function openSearch(query = ""): Promise<void> {
  if (!paletteController) initCommandPalette();
  await paletteController?.open(query);
}

export function closeSearch(): void {
  paletteController?.close();
}
function updateNetworkStatus(): void { const status = document.querySelector<HTMLElement>("#network-status"); const s = currentStrings(); if (status) status.textContent = navigator.onLine ? s.statusOnline : s.statusOffline; }
export function isoDate(date: Date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function shiftDate(date: string, days: number): string { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return isoDate(value); }
function tagCounts(items: Note[]): Array<[string, number]> { const counts = new Map<string, number>(); items.forEach((note) => note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1))); return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function isoWeek(date: Date): number { const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7)); return Math.ceil((((value.getTime() - Date.UTC(value.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7); }
function validIsoDate(value: string | null): boolean { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())); }
function formatTime(createdAt: string, noteDate: string): string { return formatTimeLocale(createdAt, noteDate, isoDate(new Date()), getLocale()); }
function errorMessage(error: unknown): string { const s = currentStrings(); return error instanceof Error ? error.message : s.somethingWentWrong; }
function requireElement<T extends Element>(selector: string): T { const element = document.querySelector<T>(selector); if (!element) throw new Error(`Missing required element: ${selector}`); return element; }

async function start(): Promise<void> {
  try {
    setLocale(getLocale());
    await initializeLocalData();
    await renderShell();
    if (!appOpenedTracked) {
      appOpenedTracked = true;
      void track("app_opened");
    }
  } catch (error) {
    requireElement<HTMLDivElement>("#app").innerHTML = `<main class="shell"><p class="notice error">Rook Lite could not open local storage: ${escapeHtml(errorMessage(error))}</p></main>`;
  }
}

if (import.meta.env.MODE !== "test") {
  void start();
}
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register(assetUrl("sw.js"), { scope: normalizeBase().prefix });
    });
  } else {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
  }
}
