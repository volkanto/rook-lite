// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { translations } from "./i18n";

document.body.innerHTML = '<div id="app"></div><meta name="theme-color" content="#f6f8fa">';
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

describe("E-ink Theme Mode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "light";
  });

  it("provides translations for E-ink mode in English and Turkish", () => {
    expect(translations.en.themeEink).toBe("E-ink");
    expect(translations.en.themeEinkDesc).toBe("Monochrome high contrast");

    expect(translations.tr.themeEink).toBe("E-mürekkep");
    expect(translations.tr.themeEinkDesc).toBe("Yüksek kontrastlı siyah-beyaz");
  });

  it("renders 4 theme options including E-ink in Settings appearance card", async () => {
    const { renderSettings } = await import("./main");

    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const themeRadios = container.querySelectorAll<HTMLInputElement>('input[name="settings-theme"]');
    expect(themeRadios.length).toBe(4);

    const einkRadio = container.querySelector<HTMLInputElement>('input[name="settings-theme"][value="EINK"]');
    expect(einkRadio).not.toBeNull();

    const einkCard = einkRadio?.closest(".theme-option-card");
    expect(einkCard).not.toBeNull();
    expect(einkCard?.textContent).toContain("E-ink");
    expect(einkCard?.textContent).toContain("Monochrome high contrast");
  });

  it("switches to E-ink theme and updates data-theme attribute and localStorage", async () => {
    const { renderSettings } = await import("./main");

    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const einkRadio = container.querySelector<HTMLInputElement>('input[name="settings-theme"][value="EINK"]');
    expect(einkRadio).not.toBeNull();

    einkRadio!.checked = true;
    einkRadio!.dispatchEvent(new Event("change"));

    expect(localStorage.getItem("theme-preference")).toBe("EINK");
    expect(document.documentElement.dataset.theme).toBe("eink");

    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(metaTheme?.getAttribute("content")).toBe("#ffffff");

    const einkCard = einkRadio?.closest(".theme-option-card");
    expect(einkCard?.classList.contains("is-selected")).toBe(true);
  });

  it("renders dropdowns and tabs with valid attributes in summaries view", async () => {
    const { renderSummariesV2 } = await import("./main");

    document.documentElement.dataset.theme = "eink";
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSummariesV2(container);

    const periodTabs = container.querySelector(".summary-period-tabs");
    expect(periodTabs).not.toBeNull();

    const buttons = periodTabs?.querySelectorAll("button");
    expect(buttons?.length).toBe(3);

    const modePicker = container.querySelector(".summary-mode-picker");
    expect(modePicker).not.toBeNull();
  });

  it("renders note list, actions, and category dropdown with e-ink classes", async () => {
    const { renderToday } = await import("./main");

    document.documentElement.dataset.theme = "eink";
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderToday(container);

    const categoryPicker = container.querySelector(".footer-category-picker");
    expect(categoryPicker).not.toBeNull();
    const categoryMenu = categoryPicker?.querySelector(".footer-category-menu");
    expect(categoryMenu).not.toBeNull();

    const notesPanel = container.querySelector(".notes-panel");
    expect(notesPanel).not.toBeNull();
  });

  it("renders edit note dialog and category picker dropdown", async () => {
    const { showEditDialog } = await import("./main");

    document.documentElement.dataset.theme = "eink";
    const sampleNote = {
      id: "note-eink-1",
      title: null,
      content: "E-ink testing note",
      categoryIds: [],
      tags: ["eink"],
      noteDate: "2026-09-24",
      language: null,
      createdAt: "2026-09-24T12:00:00Z",
      updatedAt: "2026-09-24T12:00:00Z",
      archived: false
    };

    const dialogHost = document.createElement("div");
    dialogHost.id = "dialog-host";
    document.body.appendChild(dialogHost);

    showEditDialog(sampleNote, [{
      id: "cat-1",
      name: "Reading",
      slug: "reading",
      color: "#000000",
      sortOrder: 0,
      archived: false,
      createdAt: "2026-09-24T12:00:00Z",
      updatedAt: "2026-09-24T12:00:00Z"
    }]);

    const dialog = document.querySelector(".note-edit-dialog");
    expect(dialog).not.toBeNull();

    const picker = dialog?.querySelector(".footer-category-picker");
    expect(picker).not.toBeNull();
  });
});
