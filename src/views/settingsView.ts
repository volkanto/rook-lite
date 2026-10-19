import { isAnalyticsEnabled, setAnalyticsEnabled, track } from "../analytics/analytics";
import { removeAnalyticsNotice, renderAnalyticsNotice } from "../analytics/notice";
import { clearAllData, storageCounts } from "../db";
import {
  createBackup,
  DEFAULT_OLLAMA_SETTINGS,
  downloadJson,
  downloadMarkdownZip,
  exportToDirectory,
  parseBackup,
  restoreBackup,
  settingsRepository
} from "../data";
import {
  currentStrings,
  getAvailableLocales,
  getLocale,
  getLocaleDefinition,
  getLocaleFlagSvg,
  setLocale,
  type SupportedLocale
} from "../i18n";
import { icons, svg } from "../icons";
import { escapeHtml } from "../markdown";
import type { OllamaSettings } from "../models";
import { appUrl } from "../routing";
import { folders, notes } from "../servicesContext";
import { DEFAULT_OLLAMA_PROMPT, testOllama } from "../summaries";
import { setTheme, type ThemePreference } from "../theme";
import { getNotePreviewDensity, setNotePreviewDensity, type NotePreviewDensity } from "../density";
import { getNotesPageLayout, setNotesPageLayout, type NotesPageLayout } from "../notesLayout";
import { errorMessage, formatBytes } from "../utils/dom";
import { APP_VERSION } from "../version";
import { showConfirm } from "../editor/modals";
import { refreshCalendar } from "./todayView";
import { renderRoute } from "../router";

export type ShellRenderer = () => Promise<void>;
let activeShellRenderer: ShellRenderer | null = null;
export function setSettingsShellRenderer(renderer: ShellRenderer): void {
  activeShellRenderer = renderer;
}

export function dataMessage(message: string, error: boolean): void {
  const element = document.querySelector<HTMLElement>("#data-message");
  if (!element) return;
  element.hidden = false;
  element.textContent = message;
  element.classList.toggle("error", error);
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
  const ollama = (await settingsRepository.get<OllamaSettings>("ollama")) ?? DEFAULT_OLLAMA_SETTINGS;
  const estimate = await navigator.storage?.estimate?.();
  const persisted = await navigator.storage?.persisted?.();
  const currentTheme = (localStorage.getItem("theme-preference") ?? "SYSTEM") as ThemePreference;
  const currentDensity = getNotePreviewDensity();
  const currentLayout = getNotesPageLayout();
  const currentLocale = getLocale();
  document.title = `${s.settingsTitle} · Rook Lite`;

  const hash = (typeof window !== "undefined" ? window.location.hash || "" : "").toLowerCase();
  const activeTab: "general" | "data" | "ai" | "privacy" =
    hash === "#data" || hash === "#storage" || hash === "#data-management-section" || hash === "#storage-section"
      ? "data"
      : hash === "#ai" || hash === "#local-ai" || hash === "#ollama"
      ? "ai"
      : hash === "#privacy" || hash === "#privacy-section"
      ? "privacy"
      : "general";

  content.innerHTML = `<div class="settings-page">
    <header class="page-head">
      <div>
        <h1>${s.settingsTitle}</h1>
        <p class="lede">${s.settingsLede}</p>
      </div>
    </header>

    <nav class="settings-tablist" role="tablist" aria-label="${s.settingsTitle}">
      <button type="button" role="tab" class="settings-tab-btn ${activeTab === "general" ? "is-active" : ""}" id="settings-tab-general" data-tab="general" aria-selected="${activeTab === "general"}" aria-controls="settings-panel-general" tabindex="${activeTab === "general" ? "0" : "-1"}">
        ${svg(icons.settings, "tab-icon")}
        <span>${s.settingsTabGeneral}</span>
      </button>
      <button type="button" role="tab" class="settings-tab-btn ${activeTab === "data" ? "is-active" : ""}" id="settings-tab-data" data-tab="data" aria-selected="${activeTab === "data"}" aria-controls="settings-panel-data" tabindex="${activeTab === "data" ? "0" : "-1"}">
        ${svg(icons.export, "tab-icon")}
        <span>${s.settingsTabData}</span>
      </button>
      <button type="button" role="tab" class="settings-tab-btn ${activeTab === "ai" ? "is-active" : ""}" id="settings-tab-ai" data-tab="ai" aria-selected="${activeTab === "ai"}" aria-controls="settings-panel-ai" tabindex="${activeTab === "ai" ? "0" : "-1"}">
        ${svg(icons.summary, "tab-icon")}
        <span>${s.localAiTitle}</span>
      </button>
      <button type="button" role="tab" class="settings-tab-btn ${activeTab === "privacy" ? "is-active" : ""}" id="settings-tab-privacy" data-tab="privacy" aria-selected="${activeTab === "privacy"}" aria-controls="settings-panel-privacy" tabindex="${activeTab === "privacy" ? "0" : "-1"}">
        ${svg(icons.shield, "tab-icon")}
        <span>${s.settingsTabPrivacy}</span>
      </button>
    </nav>

    <div class="settings-tab-panels">
      <div class="settings-tab-panel ${activeTab === "general" ? "is-active" : ""}" id="settings-panel-general" data-tab-panel="general" role="tabpanel" aria-labelledby="settings-tab-general" ${activeTab === "general" ? "" : "hidden"}>
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
                <span class="settings-row-label">${s.noteDensityTitle}</span>
                <span class="settings-row-desc">${s.noteDensityDesc}</span>
              </div>
              <div class="settings-segmented-control" role="radiogroup" aria-label="${s.noteDensityTitle}">
                ${([
                  ["compact", s.densityCompact],
                  ["comfortable", s.densityComfortable],
                  ["full", s.densityFull]
                ] as const).map(([val, label]) => `
                  <label class="settings-segmented-btn ${currentDensity === val ? "is-active" : ""}">
                    <input type="radio" name="settings-note-density" value="${val}" ${currentDensity === val ? "checked" : ""} class="visually-hidden">
                    <span>${label}</span>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">${s.notesLayoutTitle}</span>
                <span class="settings-row-desc">${s.notesLayoutDesc}</span>
              </div>
              <div class="settings-segmented-control" role="radiogroup" aria-label="${s.notesLayoutTitle}">
                ${([
                  ["one-column", s.layoutOneColumn],
                  ["two-columns", s.layoutTwoColumns]
                ] as const).map(([val, label]) => `
                  <label class="settings-segmented-btn ${currentLayout === val ? "is-active" : ""}">
                    <input type="radio" name="settings-notes-layout" value="${val}" ${currentLayout === val ? "checked" : ""} class="visually-hidden">
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
              <details class="settings-lang-dropdown" id="settings-lang-dropdown">
                <summary class="settings-lang-summary" aria-haspopup="menu" aria-label="${s.languageTitle}">
                  <span class="settings-lang-current">
                    <span class="lang-option-flag">${getLocaleFlagSvg(currentLocale)}</span>
                    <span>${escapeHtml(getLocaleDefinition(currentLocale).label)}</span>
                  </span>
                  ${svg(icons.chevronDown, "settings-lang-chevron")}
                </summary>
                <div class="settings-lang-menu" role="radiogroup" aria-label="${s.languageTitle}">
                  ${getAvailableLocales().map((loc) => `
                    <label class="settings-lang-item settings-segmented-btn ${currentLocale === loc.code ? "is-active" : ""}">
                      <input type="radio" name="settings-language" value="${loc.code}" ${currentLocale === loc.code ? "checked" : ""} class="visually-hidden">
                      <span class="lang-option-flag">${getLocaleFlagSvg(loc.code)}</span>
                      <span class="settings-lang-item-label">${escapeHtml(loc.label)}</span>
                      ${currentLocale === loc.code ? `<span class="lang-active-check">${svg(icons.check, "lang-check-svg")}</span>` : ""}
                    </label>
                  `).join("")}
                </div>
              </details>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="settings-section-title">${s.keyboardShortcutsTitle}</h2>

            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">${s.keyboardShortcutsTitle}</span>
                <span class="settings-row-desc">${s.keyboardShortcutsDesc}</span>
              </div>
              <div class="settings-row-action">
                <button type="button" data-action="open-shortcuts" class="secondary-button" title="${s.viewShortcuts} (?)" aria-label="${s.viewShortcuts}">${svg(icons.keyboard, "btn-action-icon")}<span>${s.viewShortcuts}</span></button>
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
                <a href="https://github.com/volkanto/rook-lite" target="_blank" rel="noopener noreferrer" class="secondary-button" title="GitHub" aria-label="GitHub">${svg(icons.github, "btn-action-icon")}<span>GitHub</span></a>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="settings-tab-panel ${activeTab === "data" ? "is-active" : ""}" id="settings-panel-data" data-tab-panel="data" role="tabpanel" aria-labelledby="settings-tab-data" ${activeTab === "data" ? "" : "hidden"}>
        <div class="settings-streamlined-stack">
          <section class="settings-section" id="storage-section">
            <h2 class="settings-section-title">${s.storageTitle}</h2>
            
            <div class="settings-row">
              <div class="settings-row-info">
                <span class="settings-row-label">${s.storageTitle}</span>
                <span class="settings-row-desc">${counts.notes} ${counts.notes === 1 ? s.entrySingle : s.entryPlural} · ${counts.summaries} ${s.navSummaries.toLowerCase()}${estimate?.usage ? ` · ${formatBytes(estimate.usage)}` : ""}${estimate?.quota ? ` / ${formatBytes(estimate.quota)}` : ""}</span>
                ${estimate?.quota ? `
                  <div class="storage-meter" aria-hidden="true">
                    <div class="storage-meter-bar" style="width: ${Math.min(100, Math.max(2, Math.round(((estimate.usage ?? 0) / estimate.quota) * 100)))}%"></div>
                  </div>
                  <span class="storage-quota-hint">${s.storageQuotaHint}</span>
                ` : ""}
              </div>
              <div class="settings-row-action">
                ${persisted ? `<span class="persistence-status-badge">✓ ${s.persistencePersisted}</span>` : `<button type="button" id="request-persistence" class="secondary-button" title="${s.requestPersistenceBtn}" aria-label="${s.requestPersistenceBtn}">${svg(icons.shield, "btn-action-icon")}<span>${s.requestPersistenceBtn}</span></button>`}
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
                <button type="button" id="delete-local-data" class="danger-save-btn" title="${s.clearAllDataBtn}" aria-label="${s.clearAllDataBtn}">${svg(icons.trash, "btn-action-icon")}<span>${s.clearAllDataBtn}</span></button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="settings-tab-panel ${activeTab === "ai" ? "is-active" : ""}" id="settings-panel-ai" data-tab-panel="ai" role="tabpanel" aria-labelledby="settings-tab-ai" ${activeTab === "ai" ? "" : "hidden"}>
        <div class="settings-streamlined-stack">
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
                    <span class="advanced-prompt-title">Advanced options (Temperature &amp; Prompt)</span>
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
                  <button type="button" id="test-ollama" class="secondary-button" title="${s.testConnectionBtn}" aria-label="${s.testConnectionBtn}" disabled>${svg(icons.refresh, "btn-action-icon")}<span>${s.testConnectionBtn}</span></button>
                  <button type="submit" class="save-btn-rect" title="${s.saveAiSettingsBtn}" aria-label="${s.saveAiSettingsBtn}" disabled>${svg(icons.check, "btn-action-icon")}<span>${s.saveAiSettingsBtn}</span></button>
                </div>
                <div id="ollama-status" class="notice" hidden aria-live="polite"></div>
              </form>
            </div>
          </section>
        </div>
      </div>

      <div class="settings-tab-panel ${activeTab === "privacy" ? "is-active" : ""}" id="settings-panel-privacy" data-tab-panel="privacy" role="tabpanel" aria-labelledby="settings-tab-privacy" ${activeTab === "privacy" ? "" : "hidden"}>
        <div class="settings-streamlined-stack">
          <section class="settings-section" id="privacy-section">
            <h2 class="settings-section-title">${s.privacyTitle}</h2>

            <div class="settings-row settings-toggle-row">
              <div class="settings-row-info">
                <div class="title-with-badge">
                  <span class="settings-row-label">${s.analyticsTitle}</span>
                  <span class="ai-privacy-pill" id="analytics-status-pill">${analyticsEnabled ? s.analyticsStatusEnabled : s.analyticsStatusDisabled}</span>
                </div>
                <span class="settings-row-desc">${s.analyticsSubtitle}</span>
                <details class="privacy-details-disclosure">
                  <summary class="privacy-disclosure-summary">
                    <span>${s.analyticsNeverCollectedTitle}</span>
                    ${svg(icons.chevronDown, "disclosure-chevron-svg")}
                  </summary>
                  <div class="analytics-privacy-details">
                    <ul class="analytics-never-collected-list">
                      <li>${s.analyticsNeverNoteContents}</li>
                      <li>${s.analyticsNeverNoteTitles}</li>
                      <li>${s.analyticsNeverTags}</li>
                      <li>${s.analyticsNeverSearches}</li>
                      <li>${s.analyticsNeverAi}</li>
                      <li>${s.analyticsNeverIdentifiers}</li>
                    </ul>
                  </div>
                </details>
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
        </div>
      </div>
    </div>
  </div>`;
  bindSettingsEvents(content);
}

export function bindSettingsEvents(content: HTMLElement): void {
  const s = currentStrings();

  const tabs = Array.from(content.querySelectorAll<HTMLButtonElement>(".settings-tab-btn"));
  const panels = Array.from(content.querySelectorAll<HTMLElement>(".settings-tab-panel"));

  const switchTab = (tabId: string, updateHash = true) => {
    tabs.forEach((btn) => {
      const isTarget = btn.dataset.tab === tabId;
      btn.classList.toggle("is-active", isTarget);
      btn.setAttribute("aria-selected", isTarget ? "true" : "false");
      btn.tabIndex = isTarget ? 0 : -1;
    });

    panels.forEach((panel) => {
      const isTarget = panel.dataset.tabPanel === tabId;
      if (isTarget) {
        panel.removeAttribute("hidden");
        panel.classList.add("is-active");
      } else {
        panel.setAttribute("hidden", "hidden");
        panel.classList.remove("is-active");
      }
    });

    if (updateHash && typeof window !== "undefined" && history.replaceState) {
      history.replaceState({}, "", appUrl(`/settings#${tabId}`));
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      const tabId = tab.dataset.tab;
      if (tabId) switchTab(tabId);
    });

    tab.addEventListener("keydown", (event) => {
      let targetIndex = -1;
      if (event.key === "ArrowRight") {
        targetIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = tabs.length - 1;
      }

      if (targetIndex >= 0) {
        event.preventDefault();
        const targetTab = tabs[targetIndex];
        targetTab.focus();
        const tabId = targetTab.dataset.tab;
        if (tabId) switchTab(tabId);
      }
    });
  });

  const onHashChange = () => {
    if (!content.isConnected) {
      window.removeEventListener("hashchange", onHashChange);
      return;
    }
    const currentHash = (window.location.hash || "").toLowerCase();
    const mappedTab =
      currentHash === "#data" || currentHash === "#storage" || currentHash === "#data-management-section" || currentHash === "#storage-section"
        ? "data"
        : currentHash === "#ai" || currentHash === "#local-ai" || currentHash === "#ollama"
        ? "ai"
        : currentHash === "#privacy" || currentHash === "#privacy-section"
        ? "privacy"
        : currentHash === "#general" || currentHash === ""
        ? "general"
        : null;
    if (mappedTab) {
      switchTab(mappedTab, false);
    }
  };
  window.addEventListener("hashchange", onHashChange);
  content.querySelectorAll<HTMLInputElement>('input[name="settings-language"]').forEach((input) => {
    input.addEventListener("change", () => {
      const selected = input.value as SupportedLocale;
      if (selected === getLocale()) return;
      setLocale(selected);
      if (activeShellRenderer) {
        void activeShellRenderer();
      }
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
  content.querySelectorAll<HTMLInputElement>('input[name="settings-note-density"]').forEach((input) => {
    input.addEventListener("change", () => {
      setNotePreviewDensity(input.value as NotePreviewDensity);
      const control = input.closest(".settings-segmented-control");
      control?.querySelectorAll(".settings-segmented-btn").forEach((btn) => {
        const isMatch = (btn.querySelector("input") as HTMLInputElement)?.value === input.value;
        btn.classList.toggle("is-active", isMatch);
      });
    });
  });
  content.querySelectorAll<HTMLInputElement>('input[name="settings-notes-layout"]').forEach((input) => {
    input.addEventListener("change", () => {
      setNotesPageLayout(input.value as NotesPageLayout);
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
      window.setTimeout(() => {
        statusEl.hidden = true;
      }, 3000);
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
    if (!isEnabled) {
      removeAnalyticsNotice();
    } else {
      const slot = document.getElementById("privacy-notice-slot") ?? document.getElementById("analytics-notice-slot");
      if (slot) {
        await renderAnalyticsNotice(slot);
      }
    }
  });

  content.querySelector<HTMLButtonElement>("#zip-export")?.addEventListener("click", () => {
    void track("markdown_export_started");
    void Promise.all([notes.listAll(), folders.listAll()])
      .then(([allN, allF]) => {
        downloadMarkdownZip(allN, allF);
        void track("markdown_export_succeeded");
        void track("markdown_exported");
      })
      .catch((error) => {
        void track("markdown_export_failed");
        dataMessage(errorMessage(error), true);
      });
  });
  content.querySelector<HTMLButtonElement>("#directory-export")?.addEventListener("click", async () => {
    void track("markdown_export_started");
    try {
      const [allN, allF] = await Promise.all([notes.listAll(), folders.listAll()]);
      const count = await exportToDirectory(allN, allF);
      void track("markdown_export_succeeded");
      void track("markdown_exported");
      dataMessage(s.exportedNotesCount(count), false);
    } catch (error) {
      void track("markdown_export_failed");
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
          void track("backup_import_started");
          try {
            await restoreBackup(backup);
            void track("backup_import_succeeded");
            void track("backup_imported");
            await refreshCalendar();
            await renderRoute();
          } catch (error) {
            void track("backup_import_failed");
            dataMessage(errorMessage(error), true);
          }
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
