// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

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

describe("Left menu bar icons and navigation", () => {
  it("exports navItems using consistent Lucide/Feather icon family", async () => {
    const { navItems, icons, svg } = await import("./main");

    expect(navItems).toHaveLength(3);

    // Notes item uses the note document icon rather than the home icon
    const notesItem = navItems.find((item) => item.path === "/");
    expect(notesItem).toBeDefined();
    expect(notesItem?.label).toBe("Notes");
    expect(notesItem?.icon).toBe(icons.note);
    expect(notesItem?.icon).not.toBe(icons.home);

    // Summaries uses the book-open summary icon
    const summariesItem = navItems.find((item) => item.path === "/summaries");
    expect(summariesItem).toBeDefined();
    expect(summariesItem?.label).toBe("Summaries");
    expect(summariesItem?.icon).toBe(icons.summary);

    // Settings uses the cog/gear settings icon
    const settingsItem = navItems.find((item) => item.path === "/settings");
    expect(settingsItem).toBeDefined();
    expect(settingsItem?.label).toBe("Settings");
    expect(settingsItem?.icon).toBe(icons.settings);

    // All icons are rendered through the standard 24x24 Lucide/Feather SVG envelope
    navItems.forEach((item) => {
      const rendered = svg(item.icon);
      expect(rendered).toContain('viewBox="0 0 24 24"');
      expect(rendered).toContain('stroke-width="2"');
      expect(rendered).toContain('stroke="currentColor"');
      expect(rendered).toContain('fill="none"');
      expect(rendered).toContain('stroke-linecap="round"');
      expect(rendered).toContain('stroke-linejoin="round"');
    });

    // Theme and lock icons also belong to the same 24x24 icon family
    const darkThemeSvg = svg(icons.moon, "theme-dark-icon nav-svg");
    const lightThemeSvg = svg(icons.sun, "theme-light-icon nav-svg");
    const lockSvg = svg(icons.lock, "nav-svg");

    [darkThemeSvg, lightThemeSvg, lockSvg].forEach((iconSvg) => {
      expect(iconSvg).toContain('viewBox="0 0 24 24"');
      expect(iconSvg).toContain('stroke-width="2"');
      expect(iconSvg).toContain("nav-svg");
    });
  });

  it("renders the sidebar with aligned navigation icons and footer controls", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const sidebar = document.querySelector("#app-sidebar");
    expect(sidebar).not.toBeNull();

    // Brand row contains logo with tooltip
    const brand = sidebar?.querySelector(".sidebar-brand");
    expect(brand).not.toBeNull();
    expect(brand?.getAttribute("data-sidebar-tooltip")).toBe("Rook Notes Lite");

    // Nav has 3 links with nav-svg icons
    const navLinks = sidebar?.querySelectorAll("nav a");
    expect(navLinks?.length).toBe(3);
    navLinks?.forEach((link) => {
      const svgEl = link.querySelector("svg.nav-svg");
      expect(svgEl).not.toBeNull();
      expect(svgEl?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(link.hasAttribute("data-sidebar-tooltip")).toBe(true);
    });

    // Footer contains theme toggle and local-only icon, both with nav-svg
    const themeToggle = sidebar?.querySelector(".sidebar-theme-toggle");
    expect(themeToggle).not.toBeNull();
    expect(themeToggle?.querySelectorAll("svg.nav-svg").length).toBe(2);

    const darkIcon = themeToggle?.querySelector(".theme-dark-icon");
    const lightIcon = themeToggle?.querySelector(".theme-light-icon");
    expect(darkIcon).not.toBeNull();
    expect(lightIcon).not.toBeNull();

    const localOnly = sidebar?.querySelector(".local-only-icon");
    expect(localOnly).not.toBeNull();
    expect(localOnly?.querySelector("svg.nav-svg")).not.toBeNull();

    // All SVGs in sidebar navigation, footer, and collapse button have viewBox 0 0 24 24
    const allSidebarSvgs = sidebar?.querySelectorAll("svg");
    allSidebarSvgs?.forEach((svgEl) => {
      expect(svgEl.getAttribute("viewBox")).toBe("0 0 24 24");
    });
  });
});
