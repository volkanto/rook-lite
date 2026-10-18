import { track } from "../analytics/analytics";
import { currentStrings, formatMonthYear, formatShortDate } from "../i18n";
import { escapeHtml, renderMarkdown } from "../markdown";
import { downloadBlob } from "../data";
import { appUrl, assetUrl } from "../routing";
import { notes, summaries } from "../servicesContext";
import { RuleBasedSummaryEngine, summaryPeriod } from "../summaries";
import { isoDate, isoWeek, validIsoDate } from "../utils/date";
import { errorMessage, requireElement } from "../utils/dom";
import { renderRoute } from "../router";

let lastOpenedSummaryPeriodKey: string | null = null;

export function resetSummaryPeriodKey(): void {
  lastOpenedSummaryPeriodKey = null;
}

export async function renderSummaries(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const params = new URLSearchParams(location.search);
  const type = (["weekly", "monthly", "yearly", "custom"].includes(params.get("type") ?? "") ? params.get("type") : "weekly") as "weekly" | "monthly" | "yearly" | "custom";
  const anchor = validIsoDate(params.get("start")) ? (params.get("start") as string) : isoDate(new Date());
  const end = validIsoDate(params.get("end")) ? (params.get("end") as string) : anchor;
  let period;
  try {
    period = summaryPeriod(type, anchor, end);
  } catch {
    period = summaryPeriod("weekly", isoDate(new Date()));
  }
  const stored = await summaries.list();
  const current = stored.find((summary) => summary.id === `${period.type}:${period.start}:${period.end}`);
  document.title = "Summaries · Rook Lite";
  content.innerHTML = `<div class="page-head"><div><h1>Summaries</h1><p class="lede">Turn your local notes into an overview without sending them anywhere.</p></div></div><form id="summary-period-form" class="search-page-form lite-summary-controls"><div class="search-page-controls"><div class="search-filter"><label for="summary-type">Period</label><select id="summary-type" name="type">${["weekly", "monthly", "yearly", "custom"].map((option) => `<option value="${option}" ${option === period.type ? "selected" : ""}>${option[0].toUpperCase() + option.slice(1)}</option>`).join("")}</select></div><div class="search-filter"><label for="summary-start">${period.type === "custom" ? "Start" : "Date in period"}</label><input id="summary-start" name="start" type="date" value="${period.type === "custom" ? period.start : anchor}"></div><div class="search-filter" id="summary-end-wrap" ${period.type === "custom" ? "" : "hidden"}><label for="summary-end">End</label><input id="summary-end" name="end" type="date" value="${period.end}"></div></div><button type="submit">Show period</button></form><section id="summary-block" class="summary"><div class="summary-heading"><div><p class="summary-kicker">${period.start} to ${period.end}</p><h2>${period.type[0].toUpperCase() + period.type.slice(1)} summary</h2></div>${current ? '<span class="summary-status">Ready</span>' : ""}</div>${current ? `<p class="muted summary-meta"><span>${current.engine}</span>${current.model ? `<span> · ${escapeHtml(current.model)}</span>` : ""}${current.editedMarkdown ? '<span class="pill">edited</span>' : ""}</p><div class="prose">${renderMarkdown(current.editedMarkdown ?? current.generatedMarkdown)}</div><details class="summary-edit"><summary>Edit</summary><form id="summary-edit-form"><textarea name="text" rows="10">${escapeHtml(current.editedMarkdown ?? current.generatedMarkdown)}</textarea><p class="hint">Your edit is stored separately from regenerated text.</p><button type="submit">Save</button></form></details>` : '<p class="muted empty-notes">No summary created for this period yet.</p>'}<p id="summary-error" class="notice error" hidden></p><div class="summary-actions"><button type="button" id="generate-summary">${current ? "Regenerate" : "Generate summary"}</button></div></section>`;
  const periodForm = requireElement<HTMLFormElement>("#summary-period-form");
  requireElement<HTMLSelectElement>("#summary-type").addEventListener("change", (event) => {
    requireElement<HTMLElement>("#summary-end-wrap").hidden = (event.currentTarget as HTMLSelectElement).value !== "custom";
  });
  periodForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(periodForm);
    const next = new URLSearchParams({ type: data.get("type")?.toString() ?? "weekly", start: data.get("start")?.toString() ?? isoDate(new Date()) });
    if (data.get("type") === "custom") next.set("end", data.get("end")?.toString() ?? "");
    history.replaceState({}, "", appUrl(`/summaries?${next}`));
    void renderRoute();
  });
  requireElement<HTMLButtonElement>("#generate-summary").addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      const allNotes = await notes.listAll();
      const source = allNotes.filter((note) => note.noteDate >= period.start && note.noteDate <= period.end && !note.archived);
      await summaries.generate(source, period, new RuleBasedSummaryEngine());
      await renderRoute();
    } catch (error) {
      const message = requireElement<HTMLElement>("#summary-error");
      message.hidden = false;
      message.textContent = errorMessage(error);
      button.disabled = false;
    }
  });
  const fallback = sessionStorage.getItem("summary-fallback");
  if (fallback) {
    const message = requireElement<HTMLElement>("#summary-error");
    message.hidden = false;
    message.textContent = s.ollamaFallbackNotice(fallback);
    sessionStorage.removeItem("summary-fallback");
  }
  const editForm = document.querySelector<HTMLFormElement>("#summary-edit-form");
  editForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!current) return;
    await summaries.edit(current.id, new FormData(editForm).get("text")?.toString() ?? "");
    await renderRoute();
  });
}

export async function renderSummariesV2(content: HTMLElement): Promise<void> {
  const isOllamaEnabled = false;
  const params = new URLSearchParams(location.search);
  const type = (["weekly", "monthly", "custom"].includes(params.get("type") ?? "") ? params.get("type") : "weekly") as "weekly" | "monthly" | "custom";
  const anchor = validIsoDate(params.get("start")) ? (params.get("start") as string) : isoDate(new Date());
  const end = validIsoDate(params.get("end")) ? (params.get("end") as string) : anchor;
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
    const isOllama: boolean = (engine.id as string) === "ollama";
    if (isOllama) void track("ai_summary_started");
    try {
      const result = await summaries.generate(source, period, engine);
      if (result.fallbackError) {
        if (isOllama) void track("ai_summary_failed");
        sessionStorage.setItem("summary-fallback", result.fallbackError);
      } else if (result.summary.engine === "ollama") {
        void track("ai_summary_succeeded");
        void track("ai_summary_used");
      }
      await renderRoute();
    } catch (error) {
      if (isOllama) void track("ai_summary_failed");
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
