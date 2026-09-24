// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { NoteRepository } from "./db";
import { NoteService } from "./services";

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

function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

    // Footer contains theme toggle, divider, GitHub link, and local-only icon
    const footer = sidebar?.querySelector(".sidebar-footer");
    expect(footer).not.toBeNull();

    const themeToggle = footer?.querySelector(".sidebar-theme-toggle");
    const divider = footer?.querySelector(".sidebar-footer-divider");
    const githubLink = footer?.querySelector<HTMLAnchorElement>(".sidebar-github-link");
    const localOnly = footer?.querySelector(".local-only-icon");

    expect(themeToggle).not.toBeNull();
    expect(divider).not.toBeNull();
    expect(githubLink).not.toBeNull();
    expect(localOnly).not.toBeNull();

    // Verify ordering: theme toggle -> divider -> github link -> local-only
    const footerChildren = Array.from(footer?.children ?? []);
    const themeIdx = footerChildren.indexOf(themeToggle!);
    const dividerIdx = footerChildren.indexOf(divider!);
    const githubIdx = footerChildren.indexOf(githubLink!);
    const localIdx = footerChildren.indexOf(localOnly!);

    expect(themeIdx).toBeLessThan(dividerIdx);
    expect(dividerIdx).toBeLessThan(githubIdx);
    expect(githubIdx).toBeLessThan(localIdx);

    expect(githubLink?.href).toBe("https://github.com/volkanto/rook-lite");
    expect(githubLink?.querySelector("svg.nav-svg")).not.toBeNull();
    expect(themeToggle?.querySelectorAll("svg.nav-svg").length).toBe(2);

    const darkIcon = themeToggle?.querySelector(".theme-dark-icon");
    const lightIcon = themeToggle?.querySelector(".theme-light-icon");
    expect(darkIcon).not.toBeNull();
    expect(lightIcon).not.toBeNull();

    expect(localOnly?.querySelector("svg.nav-svg")).not.toBeNull();

    // All SVGs in sidebar navigation, footer, and collapse button have viewBox 0 0 24 24
    const allSidebarSvgs = sidebar?.querySelectorAll("svg");
    allSidebarSvgs?.forEach((svgEl) => {
      expect(svgEl.getAttribute("viewBox")).toBe("0 0 24 24");
    });
  });

  it("renders complete edit and delete buttons in single item note action popup", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Single note item for action menu test", today, []);

    const { renderShell } = await import("./main");
    await renderShell();

    const notesList = document.querySelector(".notes-list");
    expect(notesList).not.toBeNull();

    const noteItems = notesList?.querySelectorAll(".note-list-item");
    expect(noteItems?.length).toBe(1);

    const actions = noteItems?.[0]?.querySelector(".note-header-actions");
    expect(actions).not.toBeNull();

    const copyBtn = actions?.querySelector<HTMLButtonElement>(`[data-copy-note="${createdNote.id}"]`);
    const editBtn = actions?.querySelector<HTMLButtonElement>(`[data-edit-note="${createdNote.id}"]`);
    const deleteBtn = actions?.querySelector<HTMLButtonElement>(`[data-delete-note="${createdNote.id}"]`);

    expect(copyBtn).not.toBeNull();
    expect(editBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();

    const streamFooter = document.querySelector(".notes-stream-footer");
    expect(streamFooter).not.toBeNull();
    expect(streamFooter?.querySelector(".back-to-top-btn")).not.toBeNull();

    // Clean up created note
    await noteService.delete(createdNote.id);
  });

  it("opens redesigned edit note popup dialog with editor tools inside card and working categories", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Testing edit modal redesign", today, []);
    const testCategory = { id: "cat-1", name: "Engineering", slug: "engineering", color: "#3b82f6", sortOrder: 0, archived: false, createdAt: today, updatedAt: today };

    const { renderShell, showEditDialog } = await import("./main");
    await renderShell();

    // Open edit dialog with category
    showEditDialog(createdNote, [testCategory]);

    // Dialog is mounted in #dialog-host
    const dialog = document.querySelector(".note-edit-dialog");
    expect(dialog).not.toBeNull();

    // Header has title, formatted date badge, and close button with Lucide SVG
    const title = dialog?.querySelector("#note-edit-title");
    expect(title?.textContent).toBe("Edit note");

    const dateBadge = dialog?.querySelector(".note-edit-date-badge");
    expect(dateBadge).not.toBeNull();

    const closeBtn = dialog?.querySelector(".note-edit-close");
    expect(closeBtn).not.toBeNull();
    const closeSvg = closeBtn?.querySelector("svg.dialog-close-svg");
    expect(closeSvg?.getAttribute("viewBox")).toBe("0 0 24 24");

    // Modal form uses editor-card-modal class with tools INSIDE the card
    const editorCard = dialog?.querySelector(".editor-card");
    expect(editorCard).not.toBeNull();

    // Editor formatting tools are inside the card at the top
    const toolbar = editorCard?.querySelector(".simple-editor-toolbar");
    expect(toolbar).not.toBeNull();
    expect(toolbar?.querySelectorAll("button[data-format]").length).toBe(5);

    // Textarea is inside the card
    const textarea = editorCard?.querySelector("textarea.simple-editor-textarea");
    expect(textarea).not.toBeNull();

    // Categories section inside the editor card
    const categoryPicker = editorCard?.querySelector(".footer-category-picker");
    expect(categoryPicker).not.toBeNull();

    const categoryMenu = categoryPicker?.querySelector(".footer-category-menu");
    expect(categoryMenu).not.toBeNull();

    const categoryPill = categoryMenu?.querySelector(".category-pill");
    expect(categoryPill).not.toBeNull();
    expect(categoryPill?.textContent).toBe("#Engineering");

    // Footer actions include both Cancel and Save changes buttons
    const cancelBtn = editorCard?.querySelector<HTMLButtonElement>(".editor-modal-actions .btn-secondary");
    const saveBtn = editorCard?.querySelector<HTMLButtonElement>(".editor-modal-actions .save-btn-rect");
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn?.textContent).toBe("Cancel");
    expect(saveBtn).not.toBeNull();
    expect(saveBtn?.textContent).toBe("Save changes");

    // Clicking cancel closes the dialog
    cancelBtn?.click();
    expect(document.querySelector(".note-edit-dialog")).toBeNull();

    // Clean up
    await noteService.delete(createdNote.id);
  });

  it("renders aligned Local AI settings buttons and status notice banner", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const actionsRow = container.querySelector(".ai-actions-row");
    expect(actionsRow).not.toBeNull();

    const testBtn = actionsRow?.querySelector<HTMLButtonElement>("#test-ollama.secondary-button");
    const saveBtn = actionsRow?.querySelector<HTMLButtonElement>("button[type='submit'].save-btn-rect");
    const statusBanner = container.querySelector("#ollama-status.notice");

    expect(testBtn).not.toBeNull();
    expect(saveBtn).not.toBeNull();
    expect(statusBanner).not.toBeNull();

    // Both buttons contain action icons
    expect(testBtn?.querySelector(".btn-action-icon")).not.toBeNull();
    expect(saveBtn?.querySelector(".btn-action-icon")).not.toBeNull();

    expect(testBtn?.textContent).toContain("Test connection & refresh models");
    expect(saveBtn?.textContent).toContain("Save AI settings");
  });

  it("renders minimal date header with date title, badges, navigation, and note items with clock icon time", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Checking note time badge icon", today, []);

    const { renderToday } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderToday(container);

    const header = container.querySelector(".notes-day-header.minimal-date-header");
    expect(header).not.toBeNull();

    // Minimal date title
    const dateTitle = header?.querySelector(".minimal-date-title");
    expect(dateTitle).not.toBeNull();
    expect(dateTitle?.textContent).toContain("2026");

    // Relative badge & week badge
    const relativeBadge = header?.querySelector(".minimal-date-badge");
    expect(relativeBadge).not.toBeNull();
    expect(relativeBadge?.classList.contains("is-today")).toBe(true);
    expect(relativeBadge?.textContent).toContain("Today");
    expect(relativeBadge?.querySelector(".live-pulse-dot")).not.toBeNull();

    const weekBadge = header?.querySelector(".minimal-week-badge");
    expect(weekBadge).not.toBeNull();
    expect(weekBadge?.textContent).toContain("Week");

    // Date navigation
    const dateNav = header?.querySelector(".minimal-date-nav");
    expect(dateNav).not.toBeNull();
    expect(dateNav?.querySelector(".prev-btn")).not.toBeNull();
    expect(dateNav?.querySelector(".minimal-today-link")).not.toBeNull();
    expect(dateNav?.querySelector(".next-btn")).not.toBeNull();
    expect(dateNav?.querySelector(".minimal-calendar-btn")).not.toBeNull();

    // Note item has plain text time in 24h format with relative label
    const noteTime = container.querySelector(".note-time-text");
    expect(noteTime).not.toBeNull();
    expect(noteTime?.textContent).toMatch(/^(Today|Bugün) · \d{2}:\d{2}$/);

    await noteService.delete(createdNote.id);
  });

  it("toggles task checkbox directly in note card and updates content", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Task checklist:\n- [ ] Initial task", today, []);

    const { renderToday } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderToday(container);

    const checkbox = container.querySelector<HTMLInputElement>(".interactive-task-checkbox");
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(false);

    // Simulate clicking checkbox to toggle it
    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change", { bubbles: true }));

    // Verify database was updated with checked task
    await new Promise((resolve) => setTimeout(resolve, 50));
    const updated = (await noteService.listByDate(today)).find((n) => n.id === createdNote.id);
    expect(updated?.content).toContain("- [x] Initial task");

    await noteService.delete(createdNote.id);
  });
});
