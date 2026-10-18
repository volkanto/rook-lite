// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_NOTICE_ID,
  renderAnalyticsNotice,
  removeAnalyticsNotice,
  shouldShowAnalyticsNotice
} from "./notice";
import {
  dismissAnalyticsNotice,
  isAnalyticsNoticeDismissed,
  resetAnalyticsNoticeDismissed,
  setAnalyticsEnabled
} from "./analytics";
import { database } from "../db";

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

describe("Analytics Notification Banner", () => {
  beforeEach(async () => {
    const db = await database();
    await db.clear("settings");
    localStorage.clear();
    resetAnalyticsNoticeDismissed();
    document.body.innerHTML = '<div id="test-container"></div>';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("shouldShowAnalyticsNotice", () => {
    it("returns true by default when analytics is enabled and notice is not dismissed", async () => {
      const show = await shouldShowAnalyticsNotice();
      expect(show).toBe(true);
    });

    it("returns false if user already dismissed notice", async () => {
      dismissAnalyticsNotice();
      const show = await shouldShowAnalyticsNotice();
      expect(show).toBe(false);
    });

    it("returns false if analytics are explicitly disabled", async () => {
      await setAnalyticsEnabled(false);
      const show = await shouldShowAnalyticsNotice();
      expect(show).toBe(false);
    });

    it("returns true if analytics are explicitly re-enabled and notice was not dismissed", async () => {
      await setAnalyticsEnabled(false);
      expect(await shouldShowAnalyticsNotice()).toBe(false);

      await setAnalyticsEnabled(true);
      expect(await shouldShowAnalyticsNotice()).toBe(true);
    });
  });

  describe("renderAnalyticsNotice", () => {
    it("renders notification banner with required notice copy, settings link, and dismiss actions", async () => {
      const container = document.getElementById("test-container")!;
      const el = await renderAnalyticsNotice(container);

      expect(el).not.toBeNull();
      const notice = container.querySelector<HTMLElement>(`#${ANALYTICS_NOTICE_ID}`);
      expect(notice).not.toBeNull();
      expect(notice?.getAttribute("role")).toBe("region");

      // Verify notification copy covers the core requirements:
      // 1) Analytics are enabled
      // 2) Collects anonymous data on feature usage, no personal data / note contents
      // 3) Can disable in Settings at any time
      expect(notice?.textContent).toContain("anonymous feature usage");
      expect(notice?.textContent).toContain("zero personal data");
      expect(notice?.textContent).toContain("Settings");

      // Settings link pointing directly to #privacy tab
      const settingsLink = notice?.querySelector<HTMLAnchorElement>("a[data-link]");
      expect(settingsLink).not.toBeNull();
      expect(settingsLink?.getAttribute("href")).toContain("/settings#privacy");

      // Dismiss button and close button
      const dismissBtns = notice?.querySelectorAll<HTMLButtonElement>('[data-action="dismiss-analytics-notice"]');
      expect(dismissBtns?.length).toBe(2); // Got it button + close icon button
    });

    it("does not render when notice is already dismissed", async () => {
      dismissAnalyticsNotice();
      const container = document.getElementById("test-container")!;
      const el = await renderAnalyticsNotice(container);

      expect(el).toBeNull();
      expect(container.querySelector(`#${ANALYTICS_NOTICE_ID}`)).toBeNull();
    });

    it("does not render when analytics are disabled", async () => {
      await setAnalyticsEnabled(false);
      const container = document.getElementById("test-container")!;
      const el = await renderAnalyticsNotice(container);

      expect(el).toBeNull();
      expect(container.querySelector(`#${ANALYTICS_NOTICE_ID}`)).toBeNull();
    });

    it("dismisses banner and sets dismissal flag when primary dismiss button is clicked", async () => {
      const container = document.getElementById("test-container")!;
      await renderAnalyticsNotice(container);

      const notice = container.querySelector<HTMLElement>(`#${ANALYTICS_NOTICE_ID}`);
      expect(notice).not.toBeNull();

      const gotItBtn = notice?.querySelector<HTMLButtonElement>(".analytics-notice-btn");
      expect(gotItBtn).not.toBeNull();

      gotItBtn?.click();

      expect(isAnalyticsNoticeDismissed()).toBe(true);
      expect(notice?.classList.contains("is-dismissing")).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(container.querySelector(`#${ANALYTICS_NOTICE_ID}`)).toBeNull();
    });

    it("dismisses banner and sets dismissal flag when close icon button is clicked", async () => {
      const container = document.getElementById("test-container")!;
      await renderAnalyticsNotice(container);

      const notice = container.querySelector<HTMLElement>(`#${ANALYTICS_NOTICE_ID}`);
      const closeBtn = notice?.querySelector<HTMLButtonElement>(".analytics-notice-close");
      expect(closeBtn).not.toBeNull();

      closeBtn?.click();

      expect(isAnalyticsNoticeDismissed()).toBe(true);
      expect(notice?.classList.contains("is-dismissing")).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(container.querySelector(`#${ANALYTICS_NOTICE_ID}`)).toBeNull();
    });

    it("does not duplicate banner on multiple render calls", async () => {
      const container = document.getElementById("test-container")!;
      await renderAnalyticsNotice(container);
      await renderAnalyticsNotice(container);

      const notices = container.querySelectorAll(`#${ANALYTICS_NOTICE_ID}`);
      expect(notices.length).toBe(1);
    });

    it("removes banner via removeAnalyticsNotice helper", async () => {
      const container = document.getElementById("test-container")!;
      await renderAnalyticsNotice(container);

      expect(container.querySelector(`#${ANALYTICS_NOTICE_ID}`)).not.toBeNull();
      removeAnalyticsNotice(container);
      expect(container.querySelector(`#${ANALYTICS_NOTICE_ID}`)).toBeNull();
    });
  });

  describe("Shell and Settings Integration", () => {
    it("renders notice in shell slot by default on initial application load", async () => {
      document.body.innerHTML = '<div id="app"></div>';
      const { renderShell } = await import("../main");
      await renderShell();

      const slot = document.getElementById("privacy-notice-slot") ?? document.getElementById("analytics-notice-slot");
      expect(slot).not.toBeNull();
      const banner = slot?.querySelector(`#${ANALYTICS_NOTICE_ID}`);
      expect(banner).not.toBeNull();
    });

    it("does not render notice in shell when analytics are disabled", async () => {
      await setAnalyticsEnabled(false);
      document.body.innerHTML = '<div id="app"></div>';
      const { renderShell } = await import("../main");
      await renderShell();

      const banner = document.getElementById(ANALYTICS_NOTICE_ID);
      expect(banner).toBeNull();
    });

    it("does not render notice in shell when user previously dismissed it", async () => {
      dismissAnalyticsNotice();
      document.body.innerHTML = '<div id="app"></div>';
      const { renderShell } = await import("../main");
      await renderShell();

      const banner = document.getElementById(ANALYTICS_NOTICE_ID);
      expect(banner).toBeNull();
    });

    it("removes notice banner immediately when user toggles analytics OFF in settings", async () => {
      document.body.innerHTML = '<div id="app"></div>';
      const { renderShell, renderSettings } = await import("../main");
      await renderShell();

      expect(document.getElementById(ANALYTICS_NOTICE_ID)).not.toBeNull();

      const pageContent = document.getElementById("page-content")!;
      await renderSettings(pageContent);

      const toggle = pageContent.querySelector<HTMLInputElement>("#analytics-enabled-toggle");
      expect(toggle).not.toBeNull();
      expect(toggle?.checked).toBe(true);

      // Toggle to OFF
      toggle!.checked = false;
      toggle!.dispatchEvent(new Event("change"));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(document.getElementById(ANALYTICS_NOTICE_ID)).toBeNull();
    });

    it("redirects directly to the privacy tab when clicking Settings link in notice", async () => {
      document.body.innerHTML = '<div id="app"></div>';
      const { renderShell } = await import("../main");
      await renderShell();

      const banner = document.getElementById(ANALYTICS_NOTICE_ID);
      expect(banner).not.toBeNull();

      const settingsLink = banner?.querySelector<HTMLAnchorElement>('a[data-link][href*="/settings#privacy"]');
      expect(settingsLink).not.toBeNull();

      settingsLink?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const privacyTab = document.querySelector("#settings-tab-privacy");
      expect(privacyTab?.classList.contains("is-active")).toBe(true);

      const privacyPanel = document.querySelector("#settings-panel-privacy");
      expect(privacyPanel?.classList.contains("is-active")).toBe(true);
      expect(privacyPanel?.hasAttribute("hidden")).toBe(false);
    });
  });
});
