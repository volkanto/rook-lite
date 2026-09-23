// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { appPath, appUrl, assetUrl, normalizeAppLinks, normalizeBase } from "./routing";

describe("normalizeBase", () => {
  it("normalizes root and empty bases", () => {
    expect(normalizeBase("/")).toEqual({ prefix: "/", withoutTrailingSlash: "" });
    expect(normalizeBase("")).toEqual({ prefix: "/", withoutTrailingSlash: "" });
    expect(normalizeBase("   ")).toEqual({ prefix: "/", withoutTrailingSlash: "" });
  });

  it("normalizes subpath bases with or without slashes", () => {
    expect(normalizeBase("/rook-lite/")).toEqual({
      prefix: "/rook-lite/",
      withoutTrailingSlash: "/rook-lite"
    });
    expect(normalizeBase("/rook-lite")).toEqual({
      prefix: "/rook-lite/",
      withoutTrailingSlash: "/rook-lite"
    });
    expect(normalizeBase("rook-lite")).toEqual({
      prefix: "/rook-lite/",
      withoutTrailingSlash: "/rook-lite"
    });
  });
});

describe("appPath", () => {
  describe("root base (/)", () => {
    it("extracts app paths correctly", () => {
      expect(appPath("/", "/")).toBe("/");
      expect(appPath("/summaries", "/")).toBe("/summaries");
      expect(appPath("/settings", "/")).toBe("/settings");
      expect(appPath("", "/")).toBe("/");
    });
  });

  describe("subpath base (/rook-lite/)", () => {
    const base = "/rook-lite/";

    it("extracts app paths by stripping the subpath", () => {
      expect(appPath("/rook-lite/", base)).toBe("/");
      expect(appPath("/rook-lite", base)).toBe("/");
      expect(appPath("/rook-lite/summaries", base)).toBe("/summaries");
      expect(appPath("/rook-lite/settings", base)).toBe("/settings");
      expect(appPath("/rook-lite/search", base)).toBe("/search");
    });

    it("handles paths when accessed directly without subpath", () => {
      expect(appPath("/summaries", base)).toBe("/summaries");
      expect(appPath("/", base)).toBe("/");
    });
  });
});

describe("appUrl & assetUrl", () => {
  describe("root base (/)", () => {
    const base = "/";

    it("keeps root paths intact and is idempotent", () => {
      expect(appUrl("/", base)).toBe("/");
      expect(appUrl("/summaries", base)).toBe("/summaries");
      expect(appUrl("summaries", base)).toBe("/summaries");
      expect(appUrl("/?date=2026-09-22", base)).toBe("/?date=2026-09-22");
      expect(appUrl("./logo.png", base)).toBe("/logo.png");

      // Repeated calls do not mutate
      expect(appUrl(appUrl("/summaries", base), base)).toBe("/summaries");
      expect(appUrl(appUrl("/", base), base)).toBe("/");
    });
  });

  describe("subpath base (/rook-lite/)", () => {
    const base = "/rook-lite/";

    it("prefixes root-relative paths with base path", () => {
      expect(appUrl("/", base)).toBe("/rook-lite/");
      expect(appUrl("", base)).toBe("/rook-lite/");
      expect(appUrl("/summaries", base)).toBe("/rook-lite/summaries");
      expect(appUrl("summaries", base)).toBe("/rook-lite/summaries");
      expect(appUrl("/search?q=test", base)).toBe("/rook-lite/search?q=test");
      expect(appUrl("/summaries?type=monthly&start=2026-09-01", base)).toBe("/rook-lite/summaries?type=monthly&start=2026-09-01");
      expect(appUrl("/?date=2026-09-22", base)).toBe("/rook-lite/?date=2026-09-22");
      expect(appUrl("/?date=2026-09-22&tag=books", base)).toBe("/rook-lite/?date=2026-09-22&tag=books");
      expect(appUrl("/?date=2026-09-22#note-1", base)).toBe("/rook-lite/?date=2026-09-22#note-1");
    });

    it("is strictly idempotent and never adds extra /rook-lite/ segments", () => {
      const once = appUrl("/summaries", base);
      expect(once).toBe("/rook-lite/summaries");

      const twice = appUrl(once, base);
      expect(twice).toBe("/rook-lite/summaries");

      const thrice = appUrl(twice, base);
      expect(thrice).toBe("/rook-lite/summaries");

      expect(appUrl("/rook-lite/", base)).toBe("/rook-lite/");
      expect(appUrl("/rook-lite", base)).toBe("/rook-lite/");
      expect(appUrl("/rook-lite/?date=2026-09-22", base)).toBe("/rook-lite/?date=2026-09-22");
      expect(appUrl("/rook-lite/?date=2026-09-22&tag=books", base)).toBe("/rook-lite/?date=2026-09-22&tag=books");
      expect(appUrl("/rook-lite/summaries?type=monthly", base)).toBe("/rook-lite/summaries?type=monthly");
    });

    it("handles asset urls and prevents duplicate prefixes", () => {
      expect(assetUrl("/logo.png", base)).toBe("/rook-lite/logo.png");
      expect(assetUrl("./logo.png", base)).toBe("/rook-lite/logo.png");
      expect(assetUrl("logo.png", base)).toBe("/rook-lite/logo.png");
      expect(assetUrl(assetUrl("/logo.png", base), base)).toBe("/rook-lite/logo.png");
    });

    it("leaves external, protocol-relative, and hash links untouched", () => {
      expect(appUrl("https://example.com/docs", base)).toBe("https://example.com/docs");
      expect(appUrl("http://example.com/docs", base)).toBe("http://example.com/docs");
      expect(appUrl("//cdn.example.com/img.png", base)).toBe("//cdn.example.com/img.png");
      expect(appUrl("#note-123", base)).toBe("#note-123");
      expect(appUrl("mailto:test@example.com", base)).toBe("mailto:test@example.com");
      expect(assetUrl("data:image/png;base64,abc", base)).toBe("data:image/png;base64,abc");
    });
  });
});

describe("normalizeAppLinks", () => {
  it("normalizes DOM links and images without compounding on multiple passes", () => {
    const base = "/rook-lite/";
    const container = document.createElement("div");
    container.innerHTML = `
      <aside>
        <a href="/" data-link class="sidebar-brand">Home</a>
        <a href="/summaries" data-link>Summaries</a>
        <a href="/settings" data-link>Settings</a>
        <a href="https://external.com" data-link>External</a>
        <a href="#section">Hash</a>
        <img src="/logo.png" alt="Logo">
        <img src="data:image/png;base64,123" alt="Data">
      </aside>
      <main id="content">
        <a href="/?date=2026-09-22" data-link>Date link</a>
        <img src="/empty-notes.png" alt="Empty">
        <div class="empty-notes search-results-empty">
          <img src="/empty-notes.png" alt="Search Empty" class="empty-notes-illustration">
        </div>
      </main>
    `;

    // First pass (like initial renderRoute)
    normalizeAppLinks(container, base);

    expect(container.querySelector<HTMLAnchorElement>('.sidebar-brand')?.getAttribute("href")).toBe("/rook-lite/");
    expect(container.querySelectorAll<HTMLAnchorElement>('a[data-link]')[1].getAttribute("href")).toBe("/rook-lite/summaries");
    expect(container.querySelectorAll<HTMLAnchorElement>('a[data-link]')[2].getAttribute("href")).toBe("/rook-lite/settings");
    expect(container.querySelectorAll<HTMLAnchorElement>('a[data-link]')[3].getAttribute("href")).toBe("https://external.com");
    expect(container.querySelector<HTMLImageElement>('img[alt="Logo"]')?.getAttribute("src")).toBe("/rook-lite/logo.png");
    expect(container.querySelector<HTMLImageElement>('img[alt="Empty"]')?.getAttribute("src")).toBe("/rook-lite/empty-notes.png");
    expect(container.querySelector<HTMLImageElement>('img[alt="Search Empty"]')?.getAttribute("src")).toBe("/rook-lite/empty-notes.png");
    expect(container.querySelector<HTMLImageElement>('img[alt="Data"]')?.getAttribute("src")).toBe("data:image/png;base64,123");

    // Second pass (e.g. user navigates to Summaries, renderRoute runs again on same container)
    normalizeAppLinks(container, base);

    expect(container.querySelector<HTMLAnchorElement>('.sidebar-brand')?.getAttribute("href")).toBe("/rook-lite/");
    expect(container.querySelectorAll<HTMLAnchorElement>('a[data-link]')[1].getAttribute("href")).toBe("/rook-lite/summaries");
    expect(container.querySelectorAll<HTMLAnchorElement>('a[data-link]')[2].getAttribute("href")).toBe("/rook-lite/settings");
    expect(container.querySelector<HTMLImageElement>('img[alt="Logo"]')?.getAttribute("src")).toBe("/rook-lite/logo.png");
    expect(container.querySelector<HTMLImageElement>('img[alt="Empty"]')?.getAttribute("src")).toBe("/rook-lite/empty-notes.png");

    // Third pass (user navigates to Settings)
    normalizeAppLinks(container, base);

    expect(container.querySelectorAll<HTMLAnchorElement>('a[data-link]')[1].getAttribute("href")).toBe("/rook-lite/summaries");
    expect(container.querySelector<HTMLImageElement>('img[alt="Logo"]')?.getAttribute("src")).toBe("/rook-lite/logo.png");
  });
});
