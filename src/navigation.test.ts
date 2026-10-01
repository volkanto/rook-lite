// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
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

    expect(navItems).toHaveLength(4);

    // Notes item uses the note document icon rather than the home icon
    const notesItem = navItems.find((item) => item.path === "/");
    expect(notesItem).toBeDefined();
    expect(notesItem?.label).toBe("Notes");
    expect(notesItem?.icon).toBe(icons.note);
    expect(notesItem?.icon).not.toBe(icons.home);

    // Tasks item uses the todo checklist icon
    const todosItem = navItems.find((item) => item.path === "/todos");
    expect(todosItem).toBeDefined();
    expect(todosItem?.label).toBe("Tasks");
    expect(todosItem?.icon).toBe(icons.todo);

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

    // All icons are rendered through the standard 24x24 Tabler SVG envelope
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

    // Nav has 4 links with nav-svg icons
    const navLinks = sidebar?.querySelectorAll("nav a");
    expect(navLinks?.length).toBe(4);
    navLinks?.forEach((link) => {
      const svgEl = link.querySelector("svg.nav-svg");
      expect(svgEl).not.toBeNull();
      expect(svgEl?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(link.hasAttribute("data-sidebar-tooltip")).toBe(true);
    });

    // Footer contains theme toggle and language picker
    const footer = sidebar?.querySelector(".sidebar-footer");
    expect(footer).not.toBeNull();

    const themeToggle = footer?.querySelector(".sidebar-theme-toggle");
    const langPicker = footer?.querySelector(".sidebar-lang-picker");

    expect(themeToggle).not.toBeNull();
    expect(langPicker).not.toBeNull();

    // Verify ordering: theme toggle -> lang picker
    const footerChildren = Array.from(footer?.children ?? []);
    const themeIdx = footerChildren.indexOf(themeToggle!);
    const langIdx = footerChildren.indexOf(langPicker!);

    expect(themeIdx).toBeLessThan(langIdx);
    expect(themeToggle?.querySelectorAll("svg.nav-svg").length).toBe(2);

    const darkIcon = themeToggle?.querySelector(".theme-dark-icon");
    const lightIcon = themeToggle?.querySelector(".theme-light-icon");
    expect(darkIcon).not.toBeNull();
    expect(lightIcon).not.toBeNull();

    // All SVGs in sidebar navigation, footer, and collapse button have viewBox 0 0 24 24
    const allSidebarSvgs = sidebar?.querySelectorAll("svg");
    allSidebarSvgs?.forEach((svgEl) => {
      expect(svgEl.getAttribute("viewBox")).toBe("0 0 24 24");
    });

    // Theme toggle is a clean sidebar-theme-toggle button
    expect(themeToggle?.tagName).toBe("BUTTON");
    expect(themeToggle?.className).toBe("sidebar-theme-toggle");
  });

  it("eliminates the persistent global-header and provides search trigger in the sidebar", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    // Verify global-header is removed
    expect(document.querySelector(".global-header")).toBeNull();

    // Verify sidebar search button exists with correct attributes
    const sidebar = document.querySelector("#app-sidebar");
    const searchBtn = sidebar?.querySelector<HTMLButtonElement>(".sidebar-search-btn");
    expect(searchBtn).not.toBeNull();
    expect(searchBtn?.dataset.action).toBe("open-search");
    expect(searchBtn?.hasAttribute("data-sidebar-tooltip")).toBe(true);
    expect(searchBtn?.getAttribute("data-sidebar-tooltip")).toContain("⌘K");

    // Clicking sidebar search button opens the search modal (Command Palette)
    const modal = document.querySelector<HTMLElement>("#search-modal");
    expect(modal?.classList.contains("is-open")).toBe(false);

    searchBtn?.click();
    expect(modal?.classList.contains("is-open")).toBe(true);

    // Verify mobile-top-bar exists for mobile viewports
    const mobileBar = document.querySelector(".mobile-top-bar");
    expect(mobileBar).not.toBeNull();
    expect(mobileBar?.querySelector(".mobile-sidebar-open")).not.toBeNull();
    expect(mobileBar?.querySelector(".mobile-search-btn")).not.toBeNull();
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

    const noteEl = noteItems?.[0]?.querySelector(".note");
    expect(noteEl).not.toBeNull();
    expect(noteEl?.id).toBe(`note-${createdNote.id}`);

    const actions = noteItems?.[0]?.querySelector(".note-header-actions");
    expect(actions).not.toBeNull();

    const copyBtn = actions?.querySelector<HTMLButtonElement>(`[data-copy-note="${createdNote.id}"]`);
    const editBtn = actions?.querySelector<HTMLButtonElement>(`[data-edit-note="${createdNote.id}"]`);
    const deleteBtn = actions?.querySelector<HTMLButtonElement>(`[data-delete-note="${createdNote.id}"]`);

    expect(copyBtn).not.toBeNull();
    expect(editBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();

    // Stream footer contains only back-to-top-link (no end-of-notes-text)
    const streamFooter = document.querySelector(".notes-stream-footer");
    expect(streamFooter).not.toBeNull();
    expect(document.querySelector(".end-of-notes-text")).toBeNull();
    const backToTopLink = streamFooter?.querySelector<HTMLButtonElement>(".back-to-top-link");
    expect(backToTopLink).not.toBeNull();
    expect(backToTopLink?.dataset.action).toBe("scroll-to-top");
    expect(backToTopLink?.textContent).toContain("⌘↑");

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

  it("keeps note edit modal layout bounded and scrollable for long notes without inline height explosion", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const longContent = Array.from({ length: 80 }, (_, i) => `Line ${i + 1}: Detailed notes about project progress and milestones.`).join("\n");
    const longNote = await noteService.create(longContent, today, []);

    const { renderShell, showEditDialog } = await import("./main");
    await renderShell();

    showEditDialog(longNote, []);

    const dialog = document.querySelector(".note-edit-dialog");
    expect(dialog).not.toBeNull();

    const editorCard = dialog?.querySelector(".editor-card");
    expect(editorCard).not.toBeNull();

    const textarea = editorCard?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe(longContent);

    // Textarea does not have blown-up inline style height
    expect(textarea?.style.height).not.toMatch(/^\d{3,5}px$/);

    // Both cancel and save buttons remain mounted in the modal footer
    const cancelBtn = editorCard?.querySelector<HTMLButtonElement>(".editor-modal-actions .btn-secondary");
    const saveBtn = editorCard?.querySelector<HTMLButtonElement>(".editor-modal-actions .save-btn-rect");
    expect(cancelBtn).not.toBeNull();
    expect(saveBtn).not.toBeNull();

    cancelBtn?.click();
    expect(document.querySelector(".note-edit-dialog")).toBeNull();

    await noteService.delete(longNote.id);
  });

  it("renders Local AI settings card with toggle switch and collapsible configuration", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const localAiCard = container.querySelector(".local-ai-card");
    expect(localAiCard).not.toBeNull();

    // Toggle switch exists and is interactive
    const toggle = container.querySelector<HTMLInputElement>("#ollama-enabled-toggle");
    expect(toggle).not.toBeNull();
    expect(toggle?.disabled).toBe(false);
    expect(toggle?.checked).toBe(false);

    // Loud lock banner is removed
    expect(container.querySelector("#ollama-disabled-banner")).toBeNull();

    // Config panel is hidden by default when disabled
    const configPanel = container.querySelector<HTMLElement>("#ollama-config-panel");
    expect(configPanel?.hasAttribute("hidden")).toBe(true);

    container.remove();
  });

  it("renders minimal typographic date anchor header without pulse dot or week badge", async () => {
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

    // Typographic date anchor: no pulsing green dot and no redundant week badge
    expect(header?.querySelector(".live-pulse-dot")).toBeNull();
    expect(header?.querySelector(".minimal-week-badge")).toBeNull();
    const todayBadge = header?.querySelector(".minimal-date-badge");
    expect(todayBadge).not.toBeNull();
    expect(todayBadge?.classList.contains("is-today")).toBe(true);
    expect(todayBadge?.textContent).toMatch(/^(Today|Bugün)$/);

    // Date navigation: Today link is active and clearly present
    const dateNav = header?.querySelector(".minimal-date-nav");
    expect(dateNav).not.toBeNull();
    expect(dateNav?.querySelector(".prev-btn")).not.toBeNull();
    const todayLink = dateNav?.querySelector(".minimal-today-link");
    expect(todayLink).not.toBeNull();
    expect(todayLink?.classList.contains("is-active")).toBe(true);
    expect(dateNav?.querySelector(".next-btn")).not.toBeNull();
    expect(dateNav?.querySelector(".minimal-calendar-btn")).not.toBeNull();

    // Note item has plain text time in 24h format with relative label
    const noteTime = container.querySelector(".note-time-text");
    expect(noteTime).not.toBeNull();
    expect(noteTime?.textContent).toMatch(/^(Today|Bugün) · \d{2}:\d{2}$/);

    await noteService.delete(createdNote.id);
  });

  it("renders relative date badge for non-today date without is-today class", async () => {
    const { renderToday } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);

    // Set search param to yesterday
    const yesterday = "2026-09-29";
    history.pushState({}, "", `/?date=${yesterday}`);
    await renderToday(container);

    const header = container.querySelector(".notes-day-header.minimal-date-header");
    const badge = header?.querySelector(".minimal-date-badge");
    expect(badge).not.toBeNull();
    expect(badge?.classList.contains("is-today")).toBe(false);
    expect(badge?.querySelector(".live-pulse-dot")).toBeNull();

    // Today link in navigation is not active when on a historical date
    const todayLink = header?.querySelector(".minimal-today-link");
    expect(todayLink?.classList.contains("is-active")).toBe(false);

    // Reset url
    history.pushState({}, "", "/");
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

  it("opens redesigned delete confirmation popup dialog with alert badge, message, and buttons", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Note to test delete confirm modal", today, []);

    const { renderToday } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderToday(container);

    const deleteBtn = container.querySelector<HTMLButtonElement>(`[data-delete-note="${createdNote.id}"]`);
    expect(deleteBtn).not.toBeNull();
    deleteBtn?.click();

    const backdrop = document.querySelector("#confirm-backdrop");
    expect(backdrop).not.toBeNull();

    const dialog = document.querySelector(".lite-confirm-dialog");
    expect(dialog).not.toBeNull();

    // Check title, alert badge, message body, cancel and confirm buttons
    const title = dialog?.querySelector("#confirm-title");
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe("Delete note?");

    const alertBadge = dialog?.querySelector(".confirm-alert-icon-wrap");
    expect(alertBadge).not.toBeNull();

    const message = dialog?.querySelector(".confirm-dialog-message");
    expect(message).not.toBeNull();

    const cancelBtn = dialog?.querySelector(".btn-secondary");
    expect(cancelBtn).not.toBeNull();

    const confirmBtn = dialog?.querySelector("#confirm-action.btn-danger-confirm");
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn?.textContent).toBe("Delete note");

    // Click cancel button closes the dialog
    cancelBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".lite-confirm-dialog")).toBeNull();

    await noteService.delete(createdNote.id);
  });

  it("renders composer with stable empty state and expands full controls on focus or typing", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");

    expect(form).not.toBeNull();
    expect(textarea).not.toBeNull();
    // Empty unfocused composer does not have .has-content
    expect(form?.classList.contains("has-content")).toBe(false);

    // Textarea has placeholder
    expect(textarea?.placeholder).toBeTruthy();
    expect(textarea?.placeholder).toContain("⌘Enter to save");

    // Focusing the composer activates toolbars while textarea remains 1-row initial size
    textarea?.focus();
    expect(form?.classList.contains("has-content")).toBe(true);

    // Typing content maintains full controls
    textarea!.value = "Remember this";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(form?.classList.contains("has-content")).toBe(true);

    // Clearing and blurring collapses it back
    textarea!.value = "";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    textarea?.blur();
    form?.dispatchEvent(new Event("focusout", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    expect(form?.classList.contains("has-content")).toBe(false);
  });

  it("auto-expands textarea height when multiple lines are entered and shrinks on clear", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    expect(textarea).not.toBeNull();

    // Mock scrollHeight
    let mockScrollHeight = 38;
    Object.defineProperty(textarea, "scrollHeight", {
      get: () => mockScrollHeight,
      configurable: true,
    });

    textarea.focus();
    expect(textarea.style.height).toBe("38px");

    // When typing multiple lines (e.g. pressing enter)
    mockScrollHeight = 84;
    textarea.value = "First line\nSecond line\nThird line";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(textarea.style.height).toBe("84px");

    // Clearing textarea shrinks height back
    mockScrollHeight = 38;
    textarea.value = "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(textarea.style.height).toBe("38px");
  });

  it("copies code block to clipboard and updates button state on copy click", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create('```java\nSystem.out.println("Hello from code block");\n```', today, []);

    const { renderShell } = await import("./main");
    await renderShell();

    let copied = "";
    Object.assign(navigator, {
      clipboard: {
        writeText: async (text: string) => {
          copied = text;
        }
      }
    });

    const noteEl = document.querySelector(`#note-${createdNote.id}`);
    expect(noteEl).not.toBeNull();

    const copyBtn = noteEl?.querySelector<HTMLButtonElement>(".copy-code-btn");
    expect(copyBtn).not.toBeNull();
    expect(copyBtn?.textContent).toContain("Copy");

    copyBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    expect(copied).toContain('System.out.println("Hello from code block");');
    expect(copyBtn?.classList.contains("is-copied")).toBe(true);
    expect(copyBtn?.textContent).toContain("Copied!");

    await noteService.delete(createdNote.id);
  });

  it("toggles between write and preview modes in note composer", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const writeBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
    const previewBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    const previewPane = form?.querySelector<HTMLElement>(".editor-preview");

    expect(writeBtn).not.toBeNull();
    expect(previewBtn).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(previewPane).not.toBeNull();

    // Default state: write is active, textarea is visible, preview is hidden
    expect(writeBtn?.classList.contains("is-active")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.classList.contains("is-hidden")).toBe(true);

    // Type markdown text
    textarea!.value = "**Important task** with `code`";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    // Click Preview
    previewBtn?.click();
    expect(previewBtn?.classList.contains("is-active")).toBe(true);
    expect(writeBtn?.classList.contains("is-active")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(true);
    expect(previewPane?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.innerHTML).toContain("<strong>Important task</strong>");

    // Click Write to switch back
    writeBtn?.click();
    expect(writeBtn?.classList.contains("is-active")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.classList.contains("is-hidden")).toBe(true);
  });

  it("toggles between write and preview modes in edit note popup", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("## Header\n- [ ] Task item", today, []);

    const { renderShell, showEditDialog } = await import("./main");
    await renderShell();

    showEditDialog(createdNote, []);

    const dialog = document.querySelector(".note-edit-dialog");
    const writeBtn = dialog?.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
    const previewBtn = dialog?.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
    const textarea = dialog?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    const previewPane = dialog?.querySelector<HTMLElement>(".editor-preview");

    expect(writeBtn).not.toBeNull();
    expect(previewBtn).not.toBeNull();

    // Switch to preview
    previewBtn?.click();
    expect(previewBtn?.classList.contains("is-active")).toBe(true);
    expect(textarea?.classList.contains("is-hidden")).toBe(true);
    expect(previewPane?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.innerHTML).toContain("<h2>Header</h2>");

    // Switch back to write
    writeBtn?.click();
    expect(writeBtn?.classList.contains("is-active")).toBe(true);
    expect(textarea?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.classList.contains("is-hidden")).toBe(true);

    dialog?.querySelector<HTMLButtonElement>(".editor-modal-actions .btn-secondary")?.click();
    await noteService.delete(createdNote.id);
  });

  it("switches from preview back to write mode when clicking preview pane in composer", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const previewBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
    const writeBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    const previewPane = form?.querySelector<HTMLElement>(".editor-preview");

    textarea!.value = "Preview content";
    previewBtn?.click();
    expect(previewPane?.classList.contains("is-hidden")).toBe(false);

    // Clicking the preview pane switches back to write mode
    previewPane?.click();
    expect(writeBtn?.classList.contains("is-active")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.classList.contains("is-hidden")).toBe(true);
  });

  it("resets note composer preview mode when clicking outside the panel", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const previewBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
    const writeBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    const previewPane = form?.querySelector<HTMLElement>(".editor-preview");

    // Enter preview mode
    previewBtn?.click();
    expect(form?.classList.contains("is-preview")).toBe(true);
    expect(previewPane?.classList.contains("is-hidden")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(true);

    // Click outside of the form
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(form?.classList.contains("is-preview")).toBe(false);
    expect(writeBtn?.classList.contains("is-active")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.classList.contains("is-hidden")).toBe(true);
  });

  it("restores write mode when new-note shortcut is pressed while composer is in preview", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const previewBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    const previewPane = form?.querySelector<HTMLElement>(".editor-preview");

    previewBtn?.click();
    expect(previewPane?.classList.contains("is-hidden")).toBe(false);

    // Blur from input/textarea so global shortcut works
    (document.activeElement as HTMLElement)?.blur();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));

    expect(form?.classList.contains("is-preview")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.classList.contains("is-hidden")).toBe(true);
  });

  it("toggles distraction-free Zen mode and updates live word count", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const zenBtn = form?.querySelector<HTMLButtonElement>('[data-action="toggle-zen"]');
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    const wordCountEl = form?.querySelector<HTMLElement>(".editor-word-count");

    expect(zenBtn).not.toBeNull();
    expect(wordCountEl).not.toBeNull();

    // Initially not in zen mode
    expect(document.body.classList.contains("is-zen-mode")).toBe(false);

    // Type words and verify live word count
    textarea!.value = "Focus on writing thoughts clearly";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(wordCountEl?.textContent).toBe("5 words");

    // Click Zen button
    zenBtn?.click();
    expect(document.body.classList.contains("is-zen-mode")).toBe(true);
    expect(zenBtn?.title).toContain("Exit Zen mode");

    // Press Escape to exit Zen mode
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.body.classList.contains("is-zen-mode")).toBe(false);
    expect(zenBtn?.title).toContain("Zen mode");

    // Press Cmd+D to enter Zen mode
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "d", metaKey: true, bubbles: true }));
    expect(document.body.classList.contains("is-zen-mode")).toBe(true);

    // Press Cmd+D again to exit Zen mode
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "d", metaKey: true, bubbles: true }));
    expect(document.body.classList.contains("is-zen-mode")).toBe(false);
  });

  it("toggles Zen mode inside the edit note dialog and resets on close", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Testing zen mode in dialog", today, []);

    const { renderShell, showEditDialog, closeDialog } = await import("./main");
    await renderShell();

    showEditDialog(createdNote, []);

    const dialog = document.querySelector(".note-edit-dialog");
    const zenBtn = dialog?.querySelector<HTMLButtonElement>('[data-action="toggle-zen"]');

    expect(zenBtn).not.toBeNull();
    expect(document.body.classList.contains("is-zen-mode")).toBe(false);

    // Toggle zen mode from edit dialog
    zenBtn?.click();
    expect(document.body.classList.contains("is-zen-mode")).toBe(true);

    // Close dialog and verify zen mode is cleaned up
    closeDialog();
    expect(document.body.classList.contains("is-zen-mode")).toBe(false);

    await noteService.delete(createdNote.id);
  });

  it("keeps the journal stream clean without floating back-to-top button on empty day", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    expect(document.querySelector("#app .back-to-top-btn")).toBeNull();
    expect(document.querySelector("#app .notes-stream-footer")).toBeNull();
    expect(document.querySelector("#app .empty-notes")).not.toBeNull();
  });

  it("opens keyboard shortcuts dialog via ? key and closes with Escape or close button", async () => {
    const { renderShell, showShortcutsDialog, closeDialog } = await import("./main");
    await renderShell();

    // Trigger shortcuts modal via function
    showShortcutsDialog();
    const dialog = document.querySelector(".shortcuts-dialog");
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Keyboard Shortcuts");
    expect(dialog?.textContent).toContain("Navigation");
    expect(dialog?.textContent).toContain("Writing & Editor");

    // Close dialog
    closeDialog();
    expect(document.querySelector(".shortcuts-dialog")).toBeNull();

    // Trigger via ? key when not focused in input
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    expect(document.querySelector(".shortcuts-dialog")).not.toBeNull();

    // Close via close button
    const closeBtn = document.querySelector<HTMLButtonElement>(".shortcuts-dialog .note-edit-close");
    closeBtn?.click();
    expect(document.querySelector(".shortcuts-dialog")).toBeNull();
  });

  it("shows scroll-to-top button only when note list is long/scrollable and scrolls to top when clicked", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Note for testing back to top scroll link", today, []);

    window.scrollTo = vi.fn();
    const { renderShell, updateScrollToTopVisibility } = await import("./main");
    await renderShell();

    const streamFooter = document.querySelector<HTMLElement>(".notes-stream-footer");
    expect(streamFooter).not.toBeNull();

    // When not scrollable, footer is hidden
    expect(streamFooter?.classList.contains("is-hidden")).toBe(true);

    // Simulate long scrollable page
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    updateScrollToTopVisibility();

    // Now it is visible
    expect(streamFooter?.classList.contains("is-hidden")).toBe(false);

    const backToTopLink = document.querySelector<HTMLButtonElement>(".back-to-top-link");
    expect(backToTopLink).not.toBeNull();
    backToTopLink?.click();

    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));

    await noteService.delete(createdNote.id);
  });

  it("continues todo and bullet lists on Enter and removes empty prefix on double Enter", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    expect(textarea).not.toBeNull();

    // 1. Todo item continuation
    textarea.value = "- [ ] First task";
    textarea.setSelectionRange(16, 16);
    const enterEvent1 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(enterEvent1);

    expect(textarea.value).toBe("- [ ] First task\n- [ ] ");
    expect(textarea.selectionStart).toBe(23);

    // 2. Double enter removes the empty todo item
    const enterEvent2 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(enterEvent2);
    expect(textarea.value).toBe("- [ ] First task\n");
    expect(textarea.selectionStart).toBe(17);

    // 3. Completed todo continues as an unchecked todo
    textarea.value = "- [x] Done task";
    textarea.setSelectionRange(15, 15);
    const enterEvent3 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(enterEvent3);
    expect(textarea.value).toBe("- [x] Done task\n- [ ] ");

    // 4. Bullet item continuation and double enter removal with asterisk (*)
    textarea.value = "* Bullet one";
    textarea.setSelectionRange(12, 12);
    const enterEvent4 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(enterEvent4);
    expect(textarea.value).toBe("* Bullet one\n* ");

    // Double enter on empty asterisk bullet removes the bullet
    const enterEvent5 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(enterEvent5);
    expect(textarea.value).toBe("* Bullet one\n");

    // 5. Shift+Enter does not continue list
    textarea.value = "* Bullet item";
    textarea.setSelectionRange(13, 13);
    const shiftEnterEvent = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true });
    textarea.dispatchEvent(shiftEnterEvent);
    expect(textarea.value).toBe("* Bullet item");

    // 6. Bullet format button formats with asterisk (*)
    textarea.value = "";
    textarea.setSelectionRange(0, 0);
    const listBtn = form?.querySelector<HTMLButtonElement>('button[data-format="list"]');
    listBtn?.click();
    expect(textarea.value).toBe("* ");
  });

  it("renders aligned todo items with task classes in editor preview", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form")!;
    const textarea = form.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    const previewBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
    const previewPane = form.querySelector<HTMLElement>(".editor-preview")!;

    textarea.value = "- [ ] First aligned todo\n- [x] Second aligned todo";
    previewBtn?.click();

    expect(previewPane.classList.contains("is-hidden")).toBe(false);
    const taskItems = previewPane.querySelectorAll(".task-list-item");
    expect(taskItems.length).toBe(2);

    const checkboxes = previewPane.querySelectorAll<HTMLInputElement>(".interactive-task-checkbox");
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);

    const contents = previewPane.querySelectorAll(".task-item-content");
    expect(contents.length).toBe(2);
    expect(contents[0].textContent).toBe("First aligned todo");
    expect(contents[1].textContent).toBe("Second aligned todo");
  });

  it("handles smart list continuation in the edit note dialog", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("- [ ] Edit dialog task", today, []);

    const { renderShell, showEditDialog, closeDialog } = await import("./main");
    await renderShell();

    showEditDialog(createdNote, []);

    const dialog = document.querySelector(".note-edit-dialog");
    const textarea = dialog?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    expect(textarea).not.toBeNull();

    textarea.setSelectionRange(22, 22);
    const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(enterEvent);

    expect(textarea.value).toBe("- [ ] Edit dialog task\n- [ ] ");

    // Double enter removes the empty task item
    const doubleEnter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    textarea.dispatchEvent(doubleEnter);
    expect(textarea.value).toBe("- [ ] Edit dialog task\n");

    closeDialog();
    await noteService.delete(createdNote.id);
  });

  it("renders clean date labels without extra icon prefix in summaries page date fields", async () => {
    const { renderSummariesV2 } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);

    await renderSummariesV2(container);

    const dateLabels = container.querySelectorAll(".summary-date-fields .summary-date-label");
    expect(dateLabels.length).toBeGreaterThanOrEqual(1);

    // No extra icon prefix inside labels
    expect(container.querySelector(".summary-date-fields svg")).toBeNull();

    // Date inputs exist for start and end
    const dateInputs = container.querySelectorAll('.summary-date-fields input[type="date"]');
    expect(dateInputs.length).toBe(2);

    container.remove();
  });
});
