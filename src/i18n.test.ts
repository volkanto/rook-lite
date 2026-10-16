// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { currentStrings, formatDateHeading, formatMonthYear, formatShortDate, formatTimeLocale, getAvailableLocales, getLocale, setLocale, translations } from "./i18n";
import { APP_VERSION } from "./version";

// Ensure JSDOM environment has required globals before importing main.ts
document.body.innerHTML = '<div id="app"></div>';
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
});

describe("i18n internationalization and language support", () => {
  beforeEach(() => {
    localStorage.clear();
    setLocale("en");
  });

  it("automatically discovers separated locale files from src/locales/", () => {
    const locales = getAvailableLocales();
    expect(locales.length).toBeGreaterThanOrEqual(6);

    const codes = locales.map((l) => l.code);
    expect(codes).toContain("en");
    expect(codes).toContain("de");
    expect(codes).toContain("es");
    expect(codes).toContain("tr");
    expect(codes).toContain("pt-BR");
    expect(codes).toContain("fr");

    const en = locales.find((l) => l.code === "en");
    expect(en?.label).toBe("English");
    expect(en?.strings.today).toBe("Today");

    const de = locales.find((l) => l.code === "de");
    expect(de?.label).toBe("Deutsch");
    expect(de?.strings.today).toBe("Heute");

    const es = locales.find((l) => l.code === "es");
    expect(es?.label).toBe("Español");
    expect(es?.strings.today).toBe("Hoy");

    const tr = locales.find((l) => l.code === "tr");
    expect(tr?.label).toBe("Türkçe");
    expect(tr?.strings.today).toBe("Bugün");

    const pt = locales.find((l) => l.code === "pt-BR");
    expect(pt?.label).toBe("Português");
    expect(pt?.strings.today).toBe("Hoje");

    const fr = locales.find((l) => l.code === "fr");
    expect(fr?.label).toBe("Français");
    expect(fr?.strings.today).toBe("Aujourd'hui");
  });

  it("defaults to en and allows setting all supported locales", () => {
    expect(getLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");

    for (const code of ["de", "es", "tr", "pt-BR", "fr", "en"]) {
      setLocale(code);
      expect(getLocale()).toBe(code);
      expect(localStorage.getItem("language-preference")).toBe(code);
      expect(document.documentElement.lang).toBe(code);
    }
  });

  it("returns appropriate translation strings for all supported locales", () => {
    setLocale("en");
    const en = currentStrings();
    expect(en.navNotes).toBe("Notes");
    expect(en.navTodos).toBe("Tasks");
    expect(en.navSummaries).toBe("Summaries");
    expect(en.navSettings).toBe("Settings");
    expect(en.today).toBe("Today");

    setLocale("de");
    const de = currentStrings();
    expect(de.navNotes).toBe("Notizen");
    expect(de.navTodos).toBe("Aufgaben");
    expect(de.today).toBe("Heute");

    setLocale("es");
    const es = currentStrings();
    expect(es.navNotes).toBe("Notas");
    expect(es.navTodos).toBe("Tareas");
    expect(es.today).toBe("Hoy");

    setLocale("pt-BR");
    const pt = currentStrings();
    expect(pt.navNotes).toBe("Notas");
    expect(pt.navTodos).toBe("Tarefas");
    expect(pt.today).toBe("Hoje");

    setLocale("fr");
    const fr = currentStrings();
    expect(fr.navNotes).toBe("Notes");
    expect(fr.navTodos).toBe("Tâches");
    expect(fr.today).toBe("Aujourd'hui");

    setLocale("tr");
    const tr = currentStrings();
    expect(tr.navNotes).toBe("Notlar");
    expect(tr.navTodos).toBe("Görevler");
    expect(tr.navSummaries).toBe("Özetler");
    expect(tr.navSettings).toBe("Ayarlar");
    expect(tr.today).toBe("Bugün");
    expect(tr.languageTitle).toBe("Dil");
    expect(tr.todoGroupDate).toBe("Tarih");
    expect(tr.todoGroupTag).toBe("Etiket");
    expect(tr.todoGroupAll).toBe("Tümü");
    expect(tr.todoGroupToday).toBe("Bugün");
    expect(tr.todoGroupYesterday).toBe("Dün");
    expect(tr.todoGroupThisWeek).toBe("Bu hafta");
    expect(tr.todoGroupEarlier).toBe("Daha önce");
  });

  it("formats dates according to selected locale", () => {
    const testDate = "2026-09-24";
    const dateObj = new Date("2026-09-24T12:00:00");

    const enFormatted = formatDateHeading(testDate, "en");
    expect(enFormatted).toContain("September");
    expect(enFormatted).toContain("2026");

    const deFormatted = formatDateHeading(testDate, "de");
    expect(deFormatted).toContain("September");
    expect(deFormatted).toContain("2026");

    const esFormatted = formatDateHeading(testDate, "es");
    expect(esFormatted).toContain("septiembre");
    expect(esFormatted).toContain("2026");

    const frFormatted = formatDateHeading(testDate, "fr");
    expect(frFormatted).toContain("septembre");
    expect(frFormatted).toContain("2026");

    const ptFormatted = formatDateHeading(testDate, "pt-BR");
    expect(ptFormatted).toContain("setembro");
    expect(ptFormatted).toContain("2026");

    const trFormatted = formatDateHeading(testDate, "tr");
    expect(trFormatted).toContain("Eylül");
    expect(trFormatted).toContain("2026");

    const shortEn = formatShortDate(testDate, "en");
    expect(shortEn).toContain("Sep");

    const shortTr = formatShortDate(testDate, "tr");
    expect(shortTr).toContain("Eyl");

    const monthYearEn = formatMonthYear(dateObj, "en");
    expect(monthYearEn).toContain("September 2026");

    const monthYearTr = formatMonthYear(dateObj, "tr");
    expect(monthYearTr).toContain("Eylül 2026");

    const timeEn = formatTimeLocale("2026-09-24T14:30:00", testDate, testDate, "en");
    expect(timeEn).toBe("Today · 14:30");

    // Note created on 2026-09-24 for tomorrow (2026-09-25). When viewed on 2026-09-25, it must show Yesterday, NOT Today!
    const noteCreatedYesterday = formatTimeLocale("2026-09-24T14:30:00", "2026-09-25", "2026-09-25", "en");
    expect(noteCreatedYesterday).toBe("Yesterday · 14:30");

    // When viewed multiple days later, it must show the actual creation date
    const noteCreatedDaysAgo = formatTimeLocale("2026-09-24T14:30:00", "2026-09-25", "2026-09-28", "en");
    expect(noteCreatedDaysAgo).toBe("Sep 24 · 14:30");

    // Turkish locale verification
    const noteTrYesterday = formatTimeLocale("2026-09-24T14:30:00", "2026-09-25", "2026-09-25", "tr");
    expect(noteTrYesterday).toBe("Dün · 14:30");

    const noteTrDaysAgo = formatTimeLocale("2026-09-24T14:30:00", "2026-09-25", "2026-09-28", "tr");
    expect(noteTrDaysAgo).toBe("24 Eyl · 14:30");

    expect(translations.en.notesTitle).toBe("Notes");
    expect(translations.tr.notesTitle).toBe("Notlar");
  });

  it("renders the language selector in the sidebar footer and in the settings page", async () => {
    const { renderShell, renderSettings } = await import("./main");

    setLocale("en");
    await renderShell();

    // Check sidebar language picker
    const langPicker = document.querySelector(".sidebar-lang-picker");
    expect(langPicker).not.toBeNull();
    const langToggle = langPicker?.querySelector(".sidebar-lang-toggle");
    expect(langToggle).not.toBeNull();

    // Select TR in popover
    const trOption = langPicker?.querySelector<HTMLButtonElement>('[data-select-lang="tr"]');
    expect(trOption).not.toBeNull();
    trOption?.click();

    expect(getLocale()).toBe("tr");
    expect(document.documentElement.lang).toBe("tr");

    // Re-render settings and check settings language selector card
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const langRadioGroup = container.querySelectorAll<HTMLInputElement>('input[name="settings-language"]');
    expect(langRadioGroup.length).toBeGreaterThanOrEqual(2);

    const enRadio = container.querySelector<HTMLInputElement>('input[name="settings-language"][value="en"]');
    const trRadio = container.querySelector<HTMLInputElement>('input[name="settings-language"][value="tr"]');

    expect(enRadio).not.toBeNull();
    expect(trRadio).not.toBeNull();
    expect(trRadio?.checked).toBe(true);

    // Switch back to EN via radio
    if (enRadio) {
      enRadio.checked = true;
      enRadio.dispatchEvent(new Event("change"));
    }
    expect(getLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("preserves active language toggle state when toggling appearance theme", async () => {
    const { renderSettings } = await import("./main");

    setLocale("en");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const enRadio = container.querySelector<HTMLInputElement>('input[name="settings-language"][value="en"]');
    const enBtn = enRadio?.closest(".settings-segmented-btn");
    expect(enBtn?.classList.contains("is-active")).toBe(true);

    // Toggle theme to DARK
    const darkThemeRadio = container.querySelector<HTMLInputElement>('input[name="settings-theme"][value="DARK"]');
    expect(darkThemeRadio).not.toBeNull();
    darkThemeRadio!.checked = true;
    darkThemeRadio!.dispatchEvent(new Event("change"));

    // Language button must still retain is-active class
    expect(enBtn?.classList.contains("is-active")).toBe(true);

    // Toggle theme to LIGHT
    const lightThemeRadio = container.querySelector<HTMLInputElement>('input[name="settings-theme"][value="LIGHT"]');
    expect(lightThemeRadio).not.toBeNull();
    lightThemeRadio!.checked = true;
    lightThemeRadio!.dispatchEvent(new Event("change"));

    // Language button must still retain is-active class
    expect(enBtn?.classList.contains("is-active")).toBe(true);
  });

  it("allows switching back and forth between languages multiple times", async () => {
    const { renderShell } = await import("./main");

    setLocale("en");
    await renderShell();

    const getLangOption = (code: string) => document.querySelector<HTMLButtonElement>(`[data-select-lang="${code}"]`);

    expect(getLocale()).toBe("en");

    // Select TR
    getLangOption("tr")?.click();
    expect(getLocale()).toBe("tr");
    expect(document.documentElement.lang).toBe("tr");

    // Select EN
    getLangOption("en")?.click();
    expect(getLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");

    // Select TR again
    getLangOption("tr")?.click();
    expect(getLocale()).toBe("tr");

    // Select EN again
    getLangOption("en")?.click();
    expect(getLocale()).toBe("en");
  });

  it("renders views with complete Turkish translations when tr locale is active", async () => {
    const { renderSettings, renderShell } = await import("./main");

    setLocale("tr");
    await renderShell();

    // Verify Turkish sidebar labels
    const sidebar = document.querySelector("#app-sidebar");
    expect(sidebar?.textContent).toContain("Notlar");
    expect(sidebar?.textContent).toContain("Özetler");
    expect(sidebar?.textContent).toContain("Ayarlar");

    // Verify Turkish settings card titles
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    expect(container.textContent).toContain("Dil");
    expect(container.textContent).toContain("Görünüm");
    expect(container.textContent).toContain("Yerel Yapay Zeka");
    expect(container.textContent).toContain("Depolama ve Kalıcılık");
    expect(container.textContent).toContain("Dışa aktarma ve yedekleme");
    expect(container.textContent).toContain("Tehlikeli bölge");
    expect(container.textContent).toContain("Tüm verileri temizle");

    const versionBadge = container.querySelector(".version-badge");
    expect(versionBadge).not.toBeNull();
    expect(versionBadge?.textContent).toBe(`v${APP_VERSION}`);
    expect(container.textContent).toContain(`Rook Lite v${APP_VERSION}`);
  });
});
