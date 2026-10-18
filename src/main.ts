import "./app.css";
import "./lite.css";
import { track } from "./analytics/analytics";
import { renderAnalyticsNotice } from "./analytics/notice";
import { renderInternalAnalytics } from "./analytics/dashboard";
import { CommandPaletteController } from "./command-palette/commandPalette";
import type { CommandActions, CommandContext } from "./command-palette/types";
import {
  createBackup,
  downloadJson,
  downloadMarkdownZip,
  exportToDirectory,
  parseBackup,
  restoreBackup
} from "./data";
import {
  currentStrings,
  getAvailableLocales,
  getLocale,
  getLocaleDefinition,
  getLocaleFlagSvg,
  setLocale,
  type SupportedLocale
} from "./i18n";
import { icons, type NavigationItem, svg } from "./icons";
import { escapeHtml } from "./markdown";
import type { Note } from "./models";
import { appPath, appUrl, assetUrl, normalizeBase } from "./routing";
import { folders, notes } from "./servicesContext";
import { initializeLocalData } from "./services";
import { getTemplateById } from "./templates";
import { applyTheme, setTheme } from "./theme";
import { errorMessage, requireElement, updateScrollToTopVisibility } from "./utils/dom";
import { isoDate, shiftDate, validIsoDate } from "./utils/date";
import { APP_VERSION } from "./version";
import {
  closeAllDialogs,
  closeDialog,
  insertTemplateIntoEditor,
  setEditorMode,
  showConfirm,
  showEditDialog,
  showFolderModal,
  showShortcutsDialog,
  toggleZenMode
} from "./editor";
import {
  closeTodoSidePanel,
  getActiveTodoSidePanelMode,
  highlightLinkedNote,
  refreshCalendar,
  renderData,
  renderSearch,
  renderSettings,
  renderSummariesV2,
  renderToday,
  renderTodos,
  resetSummaryPeriodKey,
  setActiveTodoSidePanelMode,
  setSearchOpener,
  setSettingsShellRenderer,
  updateTodoSidePanel
} from "./views";
import { configureRouter, renderRoute } from "./router";

// Configure router with views
configureRouter({
  renderToday,
  renderSearch,
  renderSummariesV2,
  renderTodos,
  renderData,
  renderSettings,
  renderInternalAnalytics,
  highlightLinkedNote,
  closeTodoSidePanel,
  resetSummaryPeriodKey
});

// Re-export everything for backwards compatibility across tests & external consumers
export * from "./icons";
export * from "./utils/date";
export * from "./utils/dom";
export * from "./theme";
export * from "./servicesContext";
export * from "./editor";
export * from "./views";
export * from "./router";
export * from "./analytics/notice";

let paletteController: CommandPaletteController | null = null;
let currentActiveNote: Note | null = null;
let appOpenedTracked = false;
let shellEventsBound = false;

export async function renderShell(): Promise<void> {
  const app = requireElement<HTMLDivElement>("#app");
  const s = currentStrings();
  document.documentElement.classList.add("sidebar-collapsed");
  document.documentElement.lang = getLocale();
  app.innerHTML = `<div id="search-modal" class="modal-backdrop" aria-hidden="true"></div>
    <div id="dialog-host"></div><button type="button" class="scrim" data-action="close-sidebar" aria-label="${s.closeSidebar}"></button>
    <header class="mobile-top-bar"><button type="button" class="mobile-sidebar-open" data-action="toggle-sidebar" aria-label="${s.collapseSidebar}" aria-controls="app-sidebar" aria-expanded="false">${svg(icons.menu, "mobile-nav-svg")}</button></header>
    <div class="main-layout"><aside class="sidebar" id="app-sidebar"><div class="sidebar-brand-row"><a class="sidebar-brand" href="${appUrl("/")}" data-link aria-label="${s.brandTooltip} · v${APP_VERSION}" data-sidebar-tooltip="${s.brandTooltip} · v${APP_VERSION}"><img src="${assetUrl("/logo.png")}" alt="" width="32" height="32" class="sidebar-brand-logo"><span class="sidebar-brand-name">Rook notes</span></a><button type="button" class="sidebar-collapse-button" data-action="toggle-sidebar" aria-label="${s.collapseSidebar}" aria-controls="app-sidebar" aria-expanded="true">${svg(icons.sidebarCollapse, "collapse-svg")}<span class="sidebar-toggle-tooltip">${s.collapseSidebar}</span></button></div><div class="sidebar-search-row"><button type="button" class="sidebar-search-btn" data-action="open-search" aria-label="${s.searchPlaceholder}" data-sidebar-tooltip="${s.searchPlaceholder} (⌘K)">${svg(icons.search, "sidebar-search-svg nav-svg")}<span class="nav-label">${s.searchPlaceholder}</span><kbd class="sidebar-search-hotkey">⌘K</kbd></button></div><div class="sidebar-mobile-head"><span>${s.navNotes}</span><button type="button" class="sidebar-close" data-action="close-sidebar" aria-label="${s.closeSidebar}">${svg(icons.close, "sidebar-close-svg")}</button></div><nav>${renderNavigation()}</nav><div class="sidebar-footer"><button type="button" class="sidebar-theme-toggle" data-action="toggle-theme" aria-label="${s.themeToggleAria}" data-sidebar-tooltip="${document.documentElement.dataset.theme === "dark" ? s.themeToggleLight : s.themeToggleDark}">${svg(icons.moon, "theme-dark-icon nav-svg")}${svg(icons.sun, "theme-light-icon nav-svg")}<span class="nav-label theme-label">${document.documentElement.dataset.theme === "dark" ? s.themeToggleLight : s.themeToggleDark}</span></button><details class="sidebar-lang-picker" id="sidebar-lang-picker"><summary class="sidebar-lang-toggle" aria-label="${s.languageSelectTooltip}" data-sidebar-tooltip="${s.languageSelectTooltip}">${svg(icons.globe, "nav-svg")}<span class="nav-label">${s.languageTitle}</span><span class="nav-sublabel">${escapeHtml(getLocaleDefinition().label)}</span>${svg(icons.chevronDown, "nav-chevron-svg")}</summary><div class="sidebar-lang-popover" role="menu">${getAvailableLocales().map((loc) => `<button type="button" class="lang-option-btn ${getLocale() === loc.code ? "is-active" : ""}" data-select-lang="${loc.code}"><span class="lang-option-flag">${getLocaleFlagSvg(loc.code)}</span><span class="lang-option-label">${escapeHtml(loc.label)}</span>${getLocale() === loc.code ? `<span class="lang-active-check">${svg(icons.check, "lang-check-svg")}</span>` : ""}</button>`).join("")}</div></details><details class="sidebar-support-picker" id="sidebar-support-picker"><summary class="sidebar-support-toggle" aria-label="${s.supportTooltip}" data-sidebar-tooltip="${s.supportTooltip}">${svg(icons.heart, "nav-svg support-heart-icon")}<span class="nav-label">${s.supportTitle}</span>${svg(icons.chevronDown, "nav-chevron-svg")}</summary><div class="sidebar-support-popover" role="menu"><div class="support-popover-header"><span class="support-popover-title">${s.supportTitle}</span><span class="support-popover-desc">${s.supportSubtitle}</span></div><div class="support-popover-links"><a href="https://github.com/sponsors/volkanto" target="_blank" rel="noopener noreferrer" class="support-option-link"><span class="support-badge-icon github-badge">${svg(icons.heart, "support-icon-svg")}</span><div class="support-option-info"><span class="support-option-name">${s.supportGithubLabel}</span><span class="support-option-sub">${s.supportGithubDesc}</span></div>${svg(icons.externalLink, "support-ext-svg")}</a><a href="https://buymeacoffee.com/volkanto" target="_blank" rel="noopener noreferrer" class="support-option-link"><span class="support-badge-icon bmac-badge">${svg(icons.coffee, "support-icon-svg")}</span><div class="support-option-info"><span class="support-option-name">${s.supportBmacLabel}</span><span class="support-option-sub">${s.supportBmacDesc}</span></div>${svg(icons.externalLink, "support-ext-svg")}</a></div></div></details><span class="sidebar-version" title="Rook Lite v${APP_VERSION}">v${APP_VERSION}</span></div></aside><div class="shell"><div id="privacy-notice-slot" class="privacy-notice-slot"></div><main id="page-content" class="lite-shell-main" tabindex="-1"><div class="empty-notes" style="padding: 4rem 1rem; text-align: center;"><p style="color: var(--muted); font-size: 0.95rem;">Loading notes…</p></div></main></div></div>`;
  initCommandPalette();
  bindShellEvents();
  applyTheme();
  updateSidebarButton();
  await renderAnalyticsNoticeSlot();
  await renderRoute();
}

export async function renderAnalyticsNoticeSlot(): Promise<void> {
  const slot = document.getElementById("privacy-notice-slot") ?? document.getElementById("analytics-notice-slot");
  if (slot) {
    await renderAnalyticsNotice(slot);
  }
}

setSettingsShellRenderer(renderShell);

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
      void openSearch("has:task");
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
      void track("markdown_export_started");
      try {
        const [allNotes, allFolders] = await Promise.all([notes.listAll(), folders.listAll()]);
        downloadMarkdownZip(allNotes, allFolders);
        void track("markdown_export_succeeded");
        void track("markdown_exported");
      } catch (err) {
        void track("markdown_export_failed");
        alert(errorMessage(err));
      }
    },
    exportMarkdownDirectory: async () => {
      void track("markdown_export_started");
      try {
        const [allNotes, allFolders] = await Promise.all([notes.listAll(), folders.listAll()]);
        await exportToDirectory(allNotes, allFolders);
        void track("markdown_export_succeeded");
        void track("markdown_exported");
      } catch (err) {
        void track("markdown_export_failed");
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
          showConfirm(
            s.replaceDataTitle,
            s.replaceDataMessage(backup.notes.length, backup.summaries.length),
            s.restoreBackupBtn,
            async () => {
              void track("backup_import_started");
              try {
                await restoreBackup(backup);
                void track("backup_import_succeeded");
                void track("backup_imported");
                await refreshCalendar();
                await renderRoute();
              } catch (err) {
                void track("backup_import_failed");
                alert(errorMessage(err));
              }
            }
          );
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
  return items
    .map(
      (item) =>
        `${item.divider ? '<div class="sidebar-nav-divider"></div>' : ""}<a href="${appUrl(item.path)}" data-link data-path="${item.path}" data-sidebar-tooltip="${item.label}">${svg(item.icon)}<span class="nav-label">${item.label}</span></a>`
    )
    .join("");
}

export async function openSearch(query = ""): Promise<void> {
  if (!paletteController) initCommandPalette();
  await paletteController?.open(query);
}

setSearchOpener(openSearch);

export function closeSearch(): void {
  paletteController?.close();
}

function updateNetworkStatus(): void {
  const statusEl = document.querySelector<HTMLElement>("#network-status");
  const s = currentStrings();
  if (statusEl) statusEl.textContent = navigator.onLine ? s.statusOnline : s.statusOffline;
}

function toggleSidebar(): void {
  if (innerWidth <= 960) {
    document.body.classList.toggle("sidebar-drawer-open");
  } else {
    document.documentElement.classList.add("sidebar-collapsed");
  }
  updateSidebarButton();
}

function closeSidebar(): void {
  document.body.classList.remove("sidebar-drawer-open");
  updateSidebarButton();
}

function updateSidebarButton(): void {
  const visible =
    innerWidth <= 960
      ? document.body.classList.contains("sidebar-drawer-open")
      : !document.documentElement.classList.contains("sidebar-collapsed");
  document
    .querySelectorAll(".sidebar-collapse-button, .mobile-sidebar-open")
    .forEach((button) => button.setAttribute("aria-expanded", String(visible)));
}

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
  if (event.key === "/" && !editing) {
    event.preventDefault();
    void openSearch();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    void openSearch();
  }
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
    const target = activeDialog && !activeDialog.closest(".is-hidden") ? activeDialog : activeComposer ?? undefined;
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
    const dialogHost = document.querySelector<HTMLElement>("#dialog-host");
    if (dialogHost?.hasChildNodes()) {
      closeSearch();
      closeDialog();
      return;
    }
    const sidePanel = document.querySelector<HTMLElement>("#todo-side-panel.is-open");
    if (sidePanel) {
      event.preventDefault();
      const content = document.querySelector<HTMLElement>("#page-content");
      if (getActiveTodoSidePanelMode() === "edit") {
        setActiveTodoSidePanelMode("view");
        if (content) {
          void notes.listAll().then((all) => updateTodoSidePanel(content, all));
        }
      } else {
        closeTodoSidePanel();
      }
      return;
    }
    closeSearch();
    closeDialog();
    document.querySelector<HTMLDetailsElement>(".date-picker[open]")?.removeAttribute("open");
  }
}

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

    const tmplBtn = target.closest<HTMLButtonElement>("[data-insert-template]");
    if (tmplBtn) {
      event.preventDefault();
      event.stopPropagation();
      const tmplId = tmplBtn.dataset.insertTemplate ?? "";
      const tmpl = getTemplateById(tmplId, getLocale());
      if (tmpl) {
        void insertTemplateIntoEditor(tmpl.markdown);
        tmplBtn.closest("details")?.removeAttribute("open");
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
    document
      .querySelectorAll<HTMLDetailsElement>(
        ".date-picker[open], .note-action-menu[open], .sidebar-lang-picker[open], .sidebar-support-picker[open], .filter-dropdown[open], .note-folder-badge-dropdown[open], .editor-folder-picker[open], .settings-lang-dropdown[open]"
      )
      .forEach((details) => {
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

    const brokenWikilink = target.closest<HTMLAnchorElement>("a[data-wikilink-broken], a.wikilink-broken");
    if (brokenWikilink) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const link = target.closest<HTMLAnchorElement>("a[data-link]");
    if (
      link &&
      !link.hasAttribute("data-open-note") &&
      link.origin === location.origin &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      const rawHref = link.getAttribute("href");
      const targetUrl = rawHref ? appUrl(rawHref) : link.href;
      const isInsideTagPicker = Boolean(link.closest("#tag-picker"));
      if (isInsideTagPicker) {
        history.replaceState({}, "", targetUrl);
      } else {
        history.pushState({}, "", targetUrl);
      }
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
    const folderPickBtn = target.closest<HTMLButtonElement>("[data-set-folder]");
    if (folderPickBtn) {
      event.preventDefault();
      event.stopPropagation();
      const s = currentStrings();
      const folderId = folderPickBtn.dataset.setFolder || "";
      const form = folderPickBtn.closest("form");
      if (form) {
        const input = form.querySelector<HTMLInputElement>("input[name='folderId']");
        if (input) input.value = folderId;
        const nameSpan = form.querySelector<HTMLElement>(".editor-folder-badge-name");
        if (nameSpan) {
          void folders.listAll().then((allF) => {
            const chosen = allF.find((f) => f.id === folderId);
            nameSpan.textContent = chosen ? chosen.name : s.folderUnfiled;
          });
        }
        form.querySelectorAll<HTMLButtonElement>(".composer-folder-item").forEach((btn) => {
          const match = (btn.dataset.setFolder || "") === folderId;
          btn.classList.toggle("is-active", match);
          const check = btn.querySelector(".folder-check-svg");
          if (check) check.remove();
          if (match) {
            btn.insertAdjacentHTML("beforeend", svg(icons.check, "folder-check-svg"));
          }
        });
        folderPickBtn.closest("details")?.removeAttribute("open");
      }
      return;
    }

    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "create-folder") {
      event.preventDefault();
      const assignNoteId = target.closest<HTMLElement>("[data-assign-note]")?.dataset.assignNote;
      showFolderModal({
        mode: "create",
        onSave: async (name) => {
          const created = await folders.create(name);
          if (assignNoteId) {
            await notes.moveToFolder(assignNoteId, created.id);
          }
          const currentUrl = new URL(location.href);
          currentUrl.searchParams.set("folder", created.id);
          history.pushState({}, "", currentUrl.pathname + currentUrl.search);
          await renderRoute();
        }
      });
      return;
    }
    if (action === "rename-folder") {
      event.preventDefault();
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((d) => d.removeAttribute("open"));
      const folderId = target.closest<HTMLElement>("[data-folder-id]")?.dataset.folderId;
      if (folderId) {
        const folder = await folders.get(folderId);
        if (folder) {
          showFolderModal({
            mode: "rename",
            folder,
            onSave: async (newName) => {
              await folders.rename(folder.id, newName);
              await renderRoute();
            }
          });
        }
      }
      return;
    }
    if (action === "delete-folder") {
      event.preventDefault();
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((d) => d.removeAttribute("open"));
      const s = currentStrings();
      const folderId = target.closest<HTMLElement>("[data-folder-id]")?.dataset.folderId;
      if (folderId) {
        const folder = await folders.get(folderId);
        if (folder) {
          showConfirm(
            s.deleteFolderConfirmTitle,
            s.deleteFolderConfirmMessage(folder.name),
            s.deleteFolderBtn,
            async () => {
              await folders.delete(folder.id);
              const currentUrl = new URL(location.href);
              if (currentUrl.searchParams.get("folder") === folder.id) {
                currentUrl.searchParams.delete("folder");
                history.pushState({}, "", currentUrl.pathname + currentUrl.search);
              }
              await renderRoute();
            }
          );
        }
      }
      return;
    }
    if (action === "focus-composer") {
      event.preventDefault();
      const textarea = document.querySelector<HTMLTextAreaElement>("#new-note-form textarea");
      if (textarea) {
        const form = textarea.closest("form");
        if (form) setEditorMode(form, "write", false);
        textarea.focus();
      }
      return;
    }
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
    if (action === "open-search") void openSearch();
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

window.addEventListener("rook:database-blocked", () => {
  const content = document.querySelector<HTMLElement>("#page-content");
  if (content) {
    content.innerHTML = `<div class="empty-notes" style="padding:2rem 1rem; text-align:center;"><p style="font-weight:600; margin-bottom:0.5rem;">Database upgrade in progress</p><span style="color:var(--muted); font-size:0.9rem;">Please close any other open Rook Lite tabs and refresh this page.</span><div style="margin-top:1.25rem;"><button type="button" class="btn-primary" onclick="location.reload()" style="padding:0.5rem 1rem; border-radius:6px; cursor:pointer;">Reload</button></div></div>`;
  }
});

async function start(): Promise<void> {
  try {
    setLocale(getLocale());
    await renderShell();
    if (!appOpenedTracked) {
      appOpenedTracked = true;
      void track("app_opened");
    }
    void initializeLocalData().catch((err) => console.warn("initializeLocalData deferred:", err));
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
