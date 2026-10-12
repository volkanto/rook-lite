// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("Redesigned Settings Page", () => {
  beforeEach(() => {
    history.replaceState({}, "", "/settings");
  });

  it("renders category tab navigation with all 4 tabs and ARIA attributes", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const tablist = container.querySelector(".settings-tablist");
    expect(tablist).not.toBeNull();
    expect(tablist?.getAttribute("role")).toBe("tablist");

    const tabs = container.querySelectorAll<HTMLButtonElement>(".settings-tab-btn");
    expect(tabs.length).toBe(4);

    const generalTab = container.querySelector<HTMLButtonElement>("#settings-tab-general");
    const dataTab = container.querySelector<HTMLButtonElement>("#settings-tab-data");
    const aiTab = container.querySelector<HTMLButtonElement>("#settings-tab-ai");
    const privacyTab = container.querySelector<HTMLButtonElement>("#settings-tab-privacy");

    expect(generalTab).not.toBeNull();
    expect(dataTab).not.toBeNull();
    expect(aiTab).not.toBeNull();
    expect(privacyTab).not.toBeNull();

    // Default to General
    expect(generalTab?.classList.contains("is-active")).toBe(true);
    expect(generalTab?.getAttribute("aria-selected")).toBe("true");
    expect(generalTab?.tabIndex).toBe(0);

    expect(dataTab?.classList.contains("is-active")).toBe(false);
    expect(dataTab?.getAttribute("aria-selected")).toBe("false");
    expect(dataTab?.tabIndex).toBe(-1);

    // Panels
    const generalPanel = container.querySelector("#settings-panel-general");
    const dataPanel = container.querySelector("#settings-panel-data");
    expect(generalPanel?.hasAttribute("hidden")).toBe(false);
    expect(dataPanel?.hasAttribute("hidden")).toBe(true);

    container.remove();
  });

  it("switches active tab and panel on tab click", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const dataTab = container.querySelector<HTMLButtonElement>("#settings-tab-data");
    const generalTab = container.querySelector<HTMLButtonElement>("#settings-tab-general");
    const dataPanel = container.querySelector("#settings-panel-data");
    const generalPanel = container.querySelector("#settings-panel-general");

    expect(dataPanel?.hasAttribute("hidden")).toBe(true);

    dataTab?.click();

    expect(dataTab?.classList.contains("is-active")).toBe(true);
    expect(dataTab?.getAttribute("aria-selected")).toBe("true");
    expect(dataTab?.tabIndex).toBe(0);

    expect(generalTab?.classList.contains("is-active")).toBe(false);
    expect(generalTab?.getAttribute("aria-selected")).toBe("false");
    expect(generalTab?.tabIndex).toBe(-1);

    expect(dataPanel?.hasAttribute("hidden")).toBe(false);
    expect(generalPanel?.hasAttribute("hidden")).toBe(true);

    // Switch to AI tab
    const aiTab = container.querySelector<HTMLButtonElement>("#settings-tab-ai");
    const aiPanel = container.querySelector("#settings-panel-ai");
    aiTab?.click();

    expect(aiTab?.classList.contains("is-active")).toBe(true);
    expect(aiPanel?.hasAttribute("hidden")).toBe(false);
    expect(dataPanel?.hasAttribute("hidden")).toBe(true);

    container.remove();
  });

  it("supports keyboard arrow navigation across tabs", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const generalTab = container.querySelector<HTMLButtonElement>("#settings-tab-general");
    const dataTab = container.querySelector<HTMLButtonElement>("#settings-tab-data");
    const privacyTab = container.querySelector<HTMLButtonElement>("#settings-tab-privacy");

    // Press ArrowRight from General -> moves to Data
    generalTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(dataTab?.classList.contains("is-active")).toBe(true);
    expect(dataTab?.getAttribute("aria-selected")).toBe("true");

    // Press End -> moves to Privacy
    dataTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));

    expect(privacyTab?.classList.contains("is-active")).toBe(true);
    expect(privacyTab?.getAttribute("aria-selected")).toBe("true");

    // Press Home -> moves back to General
    privacyTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    expect(generalTab?.classList.contains("is-active")).toBe(true);
    expect(generalTab?.getAttribute("aria-selected")).toBe("true");

    // Press ArrowLeft from General -> wraps to Privacy
    generalTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));

    expect(privacyTab?.classList.contains("is-active")).toBe(true);
    expect(privacyTab?.getAttribute("aria-selected")).toBe("true");

    container.remove();
  });

  it("initializes to Data tab when hash is #data-management-section or #data", async () => {
    history.replaceState({}, "", "/settings#data-management-section");

    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const dataTab = container.querySelector("#settings-tab-data");
    const dataPanel = container.querySelector("#settings-panel-data");
    const generalPanel = container.querySelector("#settings-panel-general");

    expect(dataTab?.classList.contains("is-active")).toBe(true);
    expect(dataPanel?.hasAttribute("hidden")).toBe(false);
    expect(generalPanel?.hasAttribute("hidden")).toBe(true);

    container.remove();
  });

  it("initializes to Privacy tab when hash is #privacy or #privacy-section", async () => {
    history.replaceState({}, "", "/settings#privacy-section");

    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const privacyTab = container.querySelector("#settings-tab-privacy");
    const privacyPanel = container.querySelector("#settings-panel-privacy");

    expect(privacyTab?.classList.contains("is-active")).toBe(true);
    expect(privacyPanel?.hasAttribute("hidden")).toBe(false);

    container.remove();
  });

  it("updates active tab when hashchange event fires", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const aiTab = container.querySelector("#settings-tab-ai");
    const aiPanel = container.querySelector("#settings-panel-ai");
    expect(aiTab?.classList.contains("is-active")).toBe(false);

    window.location.hash = "#local-ai";
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(aiTab?.classList.contains("is-active")).toBe(true);
    expect(aiPanel?.hasAttribute("hidden")).toBe(false);

    container.remove();
  });

  it("renders privacy details disclosure with never collected list", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const disclosure = container.querySelector(".privacy-details-disclosure");
    expect(disclosure).not.toBeNull();

    const list = container.querySelector(".analytics-never-collected-list");
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll("li").length).toBe(6);

    container.remove();
  });

  it("renders storage meter and quota calculation hint when storage estimate has quota", async () => {
    const originalStorage = navigator.storage;
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 1024 * 1024, quota: 100 * 1024 * 1024 }),
        persisted: vi.fn().mockResolvedValue(true)
      }
    });

    history.replaceState({}, "", "/settings#data");
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const meter = container.querySelector(".storage-meter");
    const hint = container.querySelector(".storage-quota-hint");

    expect(meter).not.toBeNull();
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain("Allocated by your browser based on available device disk space");

    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: originalStorage
    });
    container.remove();
  });
});
