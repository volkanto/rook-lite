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

    // Brand row contains logo with tooltip including app version
    const brand = sidebar?.querySelector(".sidebar-brand");
    expect(brand).not.toBeNull();
    expect(brand?.getAttribute("data-sidebar-tooltip")).toMatch(/^Rook Notes Lite · v\d+\.\d+\.\d+/);

    // Nav has 4 links with nav-svg icons
    const navLinks = sidebar?.querySelectorAll("nav a");
    expect(navLinks?.length).toBe(4);
    navLinks?.forEach((link) => {
      const svgEl = link.querySelector("svg.nav-svg");
      expect(svgEl).not.toBeNull();
      expect(svgEl?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(link.hasAttribute("data-sidebar-tooltip")).toBe(true);
    });

    // Footer contains theme toggle, language picker, and version
    const footer = sidebar?.querySelector(".sidebar-footer");
    expect(footer).not.toBeNull();

    const themeToggle = footer?.querySelector(".sidebar-theme-toggle");
    const langPicker = footer?.querySelector(".sidebar-lang-picker");
    const versionEl = footer?.querySelector(".sidebar-version");

    expect(themeToggle).not.toBeNull();
    expect(langPicker).not.toBeNull();
    expect(versionEl).not.toBeNull();
    expect(versionEl?.textContent).toMatch(/^v\d+\.\d+\.\d+/);

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
    expect(themeToggle?.getAttribute("data-action")).toBe("toggle-theme");
    expect(themeToggle?.hasAttribute("data-sidebar-tooltip")).toBe(true);
  });

  it("harmonizes hover attributes and classes across menu bar items", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const sidebar = document.querySelector("#app-sidebar");
    expect(sidebar).not.toBeNull();

    const navLinks = sidebar?.querySelectorAll("nav a");
    const searchBtn = sidebar?.querySelector(".sidebar-search-btn");
    const themeToggle = sidebar?.querySelector(".sidebar-theme-toggle");
    const langToggle = sidebar?.querySelector(".sidebar-lang-toggle");

    expect(navLinks?.length).toBeGreaterThan(0);
    expect(searchBtn).not.toBeNull();
    expect(themeToggle).not.toBeNull();
    expect(langToggle).not.toBeNull();

    // All interactive menu items must feature consistent data-sidebar-tooltip
    expect(searchBtn?.hasAttribute("data-sidebar-tooltip")).toBe(true);
    expect(themeToggle?.hasAttribute("data-sidebar-tooltip")).toBe(true);
    expect(langToggle?.hasAttribute("data-sidebar-tooltip")).toBe(true);
    navLinks?.forEach((link) => {
      expect(link.hasAttribute("data-sidebar-tooltip")).toBe(true);
    });
  });

  it("renders left menu navigation items with identical spacing and without dividers", async () => {
    const { renderShell, renderNavigation, navItems } = await import("./main");
    await renderShell();

    // Verify navItems has no dividers
    expect(navItems.every((item) => !item.divider)).toBe(true);

    const navHtml = renderNavigation();
    expect(navHtml).not.toContain("sidebar-nav-divider");

    const sidebar = document.querySelector("#app-sidebar");
    expect(sidebar?.querySelector(".sidebar-nav-divider")).toBeNull();

    // Verify all 4 navigation destinations exist
    const navLinks = sidebar?.querySelectorAll("nav a");
    expect(navLinks?.length).toBe(4);
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
    const createdNote = await noteService.create("Single note item for action menu test", today);

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

  it("opens redesigned edit note popup dialog with editor tools inside card", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Testing edit modal redesign", today);

    const { renderShell, showEditDialog } = await import("./main");
    await renderShell();

    // Open edit dialog
    showEditDialog(createdNote);

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
    expect(toolbar?.querySelectorAll("button[data-format]").length).toBe(9);
    expect(toolbar?.querySelector("button[data-format='heading']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='bold']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='italic']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='quote']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='code']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='wikilink']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='numbered']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='list']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='task']")).not.toBeNull();

    // Textarea is inside the card
    const textarea = editorCard?.querySelector("textarea.simple-editor-textarea");
    expect(textarea).not.toBeNull();

    // Streamlined footer metadata inside the editor card
    const meta = editorCard?.querySelector(".editor-footer-meta");
    expect(meta).not.toBeNull();
    expect(meta?.querySelector(".editor-word-count")).not.toBeNull();
    expect(meta?.querySelector(".editor-save-hint")).not.toBeNull();

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
    const longNote = await noteService.create(longContent, today);

    const { renderShell, showEditDialog } = await import("./main");
    await renderShell();

    showEditDialog(longNote);

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

  it("renders Local AI settings card as visually disabled with disabled toggle switch", async () => {
    const { renderSettings } = await import("./main");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const localAiCard = container.querySelector(".local-ai-card");
    expect(localAiCard).not.toBeNull();
    expect(localAiCard?.classList.contains("is-disabled")).toBe(true);

    // Toggle switch exists and is disabled
    const toggle = container.querySelector<HTMLInputElement>("#ollama-enabled-toggle");
    expect(toggle).not.toBeNull();
    expect(toggle?.disabled).toBe(true);
    expect(toggle?.checked).toBe(false);

    // Config panel is hidden
    const configPanel = container.querySelector<HTMLElement>("#ollama-config-panel");
    expect(configPanel?.hasAttribute("hidden")).toBe(true);

    container.remove();
  });

  it("preserves testOllama functionality and fetches available models", async () => {
    const { testOllama } = await import("./summaries");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: "llama3.2:latest" },
          { name: "qwen2.5:7b" },
          { name: "mistral:latest" }
        ]
      })
    }) as unknown as typeof fetch;

    const models = await testOllama({
      enabled: true,
      endpoint: "http://localhost:11434",
      model: "llama3.2",
      temperature: 0.2,
      timeoutMs: 5000
    });

    expect(models).toContain("llama3.2:latest");
    expect(models).toContain("qwen2.5:7b");
    expect(models).toContain("mistral:latest");

    globalThis.fetch = originalFetch;
  });

  it("renders minimal typographic date anchor header without pulse dot or week badge", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Checking note time badge icon", today);

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
    const createdNote = await noteService.create("Task checklist:\n- [ ] Initial task", today);

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
    const createdNote = await noteService.create("Note to test delete confirm modal", today);

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
    expect(form?.querySelector<HTMLButtonElement>("button[type='submit']")?.disabled).toBe(true);
  });

  it("disables note creation button when editor is empty and prevents blank note creation via submit and shortcut", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const noteService = new NoteService(new NoteRepository());
    const initialNotes = await noteService.listAll();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    const submitBtn = form?.querySelector<HTMLButtonElement>("button[type='submit']")!;

    expect(form).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(submitBtn).not.toBeNull();

    // Initially empty editor has disabled submit button
    expect(submitBtn.disabled).toBe(true);

    // Whitespace only remains disabled
    textarea.value = "   \n\t  ";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(submitBtn.disabled).toBe(true);

    // Pressing Cmd+Enter with whitespace does not create a note
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(await noteService.listAll()).toHaveLength(initialNotes.length);

    // Submitting form directly while empty does not create a note
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(await noteService.listAll()).toHaveLength(initialNotes.length);

    // Entering non-whitespace text enables the submit button
    textarea.value = "A valid note content";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(submitBtn.disabled).toBe(false);

    // Submitting creates the note
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 100));

    const updatedNotes = await noteService.listAll();
    expect(updatedNotes).toHaveLength(initialNotes.length + 1);
    const createdNote = updatedNotes.find((n) => n.content === "A valid note content");
    expect(createdNote).toBeDefined();

    // Clean up
    if (createdNote) await noteService.delete(createdNote.id);
  });

  it("prompts to delete note when saving an existing note with empty content in edit dialog", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Original note before clearing", today);

    const { renderShell, showEditDialog } = await import("./main");
    await renderShell();

    showEditDialog(createdNote);

    const editForm = document.querySelector<HTMLFormElement>("#edit-note-form");
    const textarea = editForm?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    const saveBtn = editForm?.querySelector<HTMLButtonElement>(".editor-modal-actions .save-btn-rect")!;

    expect(editForm).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(saveBtn).not.toBeNull();
    expect(textarea.value).toBe("Original note before clearing");

    // Clear content completely
    textarea.value = "   ";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    // Submit the edit form with empty content
    editForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    // Confirm dialog should appear
    const confirmDialog = document.querySelector(".lite-confirm-dialog");
    expect(confirmDialog).not.toBeNull();
    expect(confirmDialog?.querySelector("#confirm-title")?.textContent).toBe("Delete note?");

    // Clicking cancel should not delete the note
    const cancelBtn = confirmDialog?.querySelector<HTMLButtonElement>(".btn-secondary");
    cancelBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    const noteStillExists = (await noteService.listAll()).find((n) => n.id === createdNote.id);
    expect(noteStillExists).toBeDefined();

    // Open edit dialog again and confirm deletion
    showEditDialog(createdNote);
    const editForm2 = document.querySelector<HTMLFormElement>("#edit-note-form");
    const textarea2 = editForm2?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    textarea2.value = "";
    editForm2?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    const confirmDialog2 = document.querySelector(".lite-confirm-dialog");
    expect(confirmDialog2).not.toBeNull();
    const confirmActionBtn = confirmDialog2?.querySelector<HTMLButtonElement>("#confirm-action");
    confirmActionBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));

    // Note should now be permanently deleted
    const deletedNote = (await noteService.listAll()).find((n) => n.id === createdNote.id);
    expect(deletedNote).toBeUndefined();
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
    const createdNote = await noteService.create('```java\nSystem.out.println("Hello from code block");\n```', today);

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

  it("renders note editor with eye icon preview toggle and Finish note button", async () => {
    const { renderShell } = await import("./main");
    await renderShell();

    const form = document.querySelector<HTMLFormElement>("#new-note-form");
    expect(form).not.toBeNull();

    // Mode toggle with eye/edit icons
    const writeBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
    const previewBtn = form?.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
    expect(writeBtn?.querySelector("svg")).not.toBeNull();
    expect(previewBtn?.querySelector("svg")).not.toBeNull();

    // Formatting tools
    const toolbar = form?.querySelector(".simple-editor-toolbar");
    expect(toolbar).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='bold']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='italic']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='code']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='wikilink']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='list']")).not.toBeNull();
    expect(toolbar?.querySelector("button[data-format='task']")).not.toBeNull();

    // Textarea with placeholder
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.placeholder).toContain("⌘Enter to save");

    // Single Finish note submit button (no separate cancel button in new-note-form)
    const submitBtn = form?.querySelector<HTMLButtonElement>("button[type='submit']");
    expect(submitBtn).not.toBeNull();
    expect(submitBtn?.textContent).toBe("Finish note");

    // Preview mode stability: switching to preview stays in preview mode even after focusout
    textarea!.value = "Preview content";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    previewBtn?.click();
    expect(form?.classList.contains("is-preview")).toBe(true);
    form?.dispatchEvent(new Event("focusout", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(form?.classList.contains("is-preview")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(true);

    // Template picker stability: opening template details keeps form expanded
    const picker = form?.querySelector<HTMLDetailsElement>(".editor-template-picker");
    expect(picker).not.toBeNull();
    picker?.setAttribute("open", "");
    picker?.dispatchEvent(new Event("toggle"));
    form?.dispatchEvent(new Event("focusout", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(form?.classList.contains("has-content")).toBe(true);

    // Clean up
    picker?.removeAttribute("open");
    writeBtn?.click();
    textarea!.value = "";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
  });

  it("toggles between write and preview modes in edit note popup", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("## Header\n- [ ] Task item", today);

    const { renderShell, showEditDialog } = await import("./main");
    await renderShell();

    showEditDialog(createdNote);

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

  it("keeps preview mode active when clicking preview pane in composer until explicitly toggled", async () => {
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

    // Clicking the preview pane stays in preview mode
    previewPane?.click();
    expect(form?.classList.contains("is-preview")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(true);
    expect(previewPane?.classList.contains("is-hidden")).toBe(false);

    // Explicitly clicking the write toggle button switches back to write mode
    writeBtn?.click();
    expect(writeBtn?.classList.contains("is-active")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(false);
    expect(textarea?.classList.contains("is-hidden")).toBe(false);
    expect(previewPane?.classList.contains("is-hidden")).toBe(true);
  });

  it("keeps note composer in preview mode when clicking outside the panel", async () => {
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

    // Click outside of the form does NOT reset preview mode
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(form?.classList.contains("is-preview")).toBe(true);
    expect(previewBtn?.classList.contains("is-active")).toBe(true);
    expect(previewPane?.classList.contains("is-hidden")).toBe(false);

    // Explicitly toggle back to write
    writeBtn?.click();
    expect(form?.classList.contains("is-preview")).toBe(false);
    expect(writeBtn?.classList.contains("is-active")).toBe(true);
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

    // Clear textarea and verify leaving zen mode restores empty composer size and collapses has-content
    textarea!.value = "";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    (document.activeElement as HTMLElement)?.blur();
    zenBtn?.click();
    expect(document.body.classList.contains("is-zen-mode")).toBe(true);

    // Leave zen mode via Escape
    (document.activeElement as HTMLElement)?.blur();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.body.classList.contains("is-zen-mode")).toBe(false);
    expect(form?.classList.contains("has-content")).toBe(false);
  });

  it("toggles Zen mode inside the edit note dialog and resets on close", async () => {
    const noteService = new NoteService(new NoteRepository());
    const today = localTodayIso();
    const createdNote = await noteService.create("Testing zen mode in dialog", today);

    const { renderShell, showEditDialog, closeDialog } = await import("./main");
    await renderShell();

    showEditDialog(createdNote);

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
    const createdNote = await noteService.create("Note for testing back to top scroll link", today);

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
    const createdNote = await noteService.create("- [ ] Edit dialog task", today);

    const { renderShell, showEditDialog, closeDialog } = await import("./main");
    await renderShell();

    showEditDialog(createdNote);

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

  it("renders tasks preserving original persisted casing without uppercase transformation", async () => {
    const { renderTodos } = await import("./main");
    const { NoteService } = await import("./services");
    const { NoteRepository } = await import("./db");
    const noteService = new NoteService(new NoteRepository());

    const note = await noteService.create("- [ ] Buy fresh groceries\n- [ ] Call Dr. Smith", "2026-10-01");

    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderTodos(container);

    const taskItems = container.querySelectorAll(".todo-item .lite-task-check span");
    expect(taskItems.length).toBeGreaterThanOrEqual(2);
    const texts = Array.from(taskItems).map((el) => el.textContent);
    expect(texts).toContain("Buy fresh groceries");
    expect(texts).toContain("Call Dr. Smith");

    // Task age chip exists
    const ageChips = container.querySelectorAll(".todo-item .todo-age-chip");
    expect(ageChips.length).toBeGreaterThanOrEqual(2);

    // Note link exists with link to note and jump icon
    const noteLinks = container.querySelectorAll(".todo-item .todo-note-link");
    expect(noteLinks.length).toBeGreaterThanOrEqual(2);
    expect((noteLinks[0] as HTMLAnchorElement).href).toContain(`#note-${note.id}`);
    expect((noteLinks[0] as HTMLAnchorElement).getAttribute("aria-label")).toContain("Go to note");
    expect((noteLinks[0] as HTMLAnchorElement).getAttribute("data-tooltip")).toContain("Go to note");
    expect(noteLinks[0].querySelector(".todo-jump-svg")).not.toBeNull();

    await noteService.delete(note.id);
    container.remove();
  });

  it("applies is-completing animation class when checking a task in todos", async () => {
    const { renderTodos } = await import("./main");
    const { NoteService } = await import("./services");
    const { NoteRepository } = await import("./db");
    const noteService = new NoteService(new NoteRepository());

    const note = await noteService.create("- [ ] Animate this task completion", "2026-10-01");
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderTodos(container);

    const checkbox = container.querySelector<HTMLInputElement>(".todo-item input[type='checkbox']");
    expect(checkbox).not.toBeNull();
    const todoItem = checkbox?.closest(".todo-item");

    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change"));

    expect(todoItem?.classList.contains("is-completing")).toBe(true);
    expect(checkbox?.disabled).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 750));

    await noteService.delete(note.id);
    container.remove();
  });

  it("calculates task age correctly with formatTaskAge", async () => {
    const { formatTaskAge } = await import("./main");

    const today = "2026-10-01";
    expect(formatTaskAge("2026-10-01", today).label).toBe("Today");
    expect(formatTaskAge("2026-10-01", today).ageClass).toBe("fresh");

    expect(formatTaskAge("2026-09-30", today).label).toBe("1d open");
    expect(formatTaskAge("2026-09-30", today).ageClass).toBe("fresh");

    expect(formatTaskAge("2026-09-27", today).label).toBe("4d open");
    expect(formatTaskAge("2026-09-27", today).ageClass).toBe("aging");

    expect(formatTaskAge("2026-09-17", today).label).toBe("2w open");
    expect(formatTaskAge("2026-09-17", today).ageClass).toBe("stale");

    expect(formatTaskAge("2026-08-01", today).label).toBe("2mo open");
    expect(formatTaskAge("2026-08-01", today).ageClass).toBe("stale");
  });

  it("groups tasks correctly by date, tag, and all using groupTasks", async () => {
    const { groupTasks } = await import("./main");
    const today = "2026-10-05";

    const noteToday: any = { id: "n1", noteDate: "2026-10-05", tags: ["work"], content: "" };
    const noteYesterday: any = { id: "n2", noteDate: "2026-10-04", tags: [], content: "" };
    const noteThisWeek: any = { id: "n3", noteDate: "2026-10-02", tags: ["personal"], content: "" };
    const noteEarlier: any = { id: "n4", noteDate: "2026-09-15", tags: ["work"], content: "" };

    const tasks = [
      { note: noteToday, line: "- [ ] Task 1", lineIndex: 0 },
      { note: noteYesterday, line: "- [ ] Task 2 #urgent", lineIndex: 0 },
      { note: noteThisWeek, line: "- [ ] Task 3", lineIndex: 0 },
      { note: noteEarlier, line: "- [ ] Task 4", lineIndex: 0 }
    ];

    // 1. Group by Date
    const dateGroups = groupTasks(tasks, "date", today);
    expect(dateGroups.map((g) => g.id)).toEqual(["today", "yesterday", "this-week", "earlier"]);
    expect(dateGroups.find((g) => g.id === "today")?.count).toBe(1);
    expect(dateGroups.find((g) => g.id === "yesterday")?.count).toBe(1);
    expect(dateGroups.find((g) => g.id === "this-week")?.count).toBe(1);
    expect(dateGroups.find((g) => g.id === "earlier")?.count).toBe(1);

    // 2. Group by Tag
    const tagGroups = groupTasks(tasks, "tag", today);
    expect(tagGroups.map((g) => g.id)).toEqual(["tag-personal", "tag-urgent", "tag-work"]);
    expect(tagGroups[0].title).toBe("#personal");
    expect(tagGroups[0].count).toBe(1);
    expect(tagGroups[1].title).toBe("#urgent");
    expect(tagGroups[1].count).toBe(1);
    expect(tagGroups[2].title).toBe("#work");
    expect(tagGroups[2].count).toBe(2);

    // 3. Test Untagged when tasks have neither note tag nor inline tag
    const untaggedNote: any = { id: "n5", noteDate: "2026-10-05", tags: [], content: "" };
    const mixedTasks = [
      { note: noteToday, line: "- [ ] Work task", lineIndex: 0 },
      { note: untaggedNote, line: "- [ ] Raw task", lineIndex: 0 }
    ];
    const mixedGroups = groupTasks(mixedTasks, "tag", today);
    expect(mixedGroups.map((g) => g.id)).toEqual(["tag-work", "untagged"]);
    expect(mixedGroups.find((g) => g.id === "untagged")?.title).toBe("Untagged");
    expect(mixedGroups.find((g) => g.id === "untagged")?.count).toBe(1);

    // 4. Group by All (Flat)
    const allGroups = groupTasks(tasks, "all", today);
    expect(allGroups).toHaveLength(1);
    expect(allGroups[0].title).toBe("");
    expect(allGroups[0].count).toBe(4);
  });

  it("renders todo grouping tabs and allows switching views with persistence", async () => {
    const { renderTodos, isoDate } = await import("./main");
    const { NoteService } = await import("./services");
    const { NoteRepository } = await import("./db");
    const noteService = new NoteService(new NoteRepository());

    const today = isoDate();
    const noteUntagged = await noteService.create("- [ ] Buy coffee beans", today);
    const noteTagged = await noteService.create("- [ ] Finish grouping pull request\n#dev", today);

    localStorage.removeItem("rook_todos_grouping");

    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderTodos(container);

    // Verify tabs exist
    const tabs = container.querySelectorAll<HTMLButtonElement>(".todo-group-tabs button");
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toBe("Date");
    expect(tabs[1].textContent).toBe("Tag");
    expect(tabs[2].textContent).toBe("All");

    // Default tab is Date
    expect(tabs[0].classList.contains("is-active")).toBe(true);
    expect(container.querySelector(".todo-group[data-group-id='today']")).not.toBeNull();

    // Switch to Tag grouping
    tabs[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(localStorage.getItem("rook_todos_grouping")).toBe("tag");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const activeTabsAfterClick = container.querySelectorAll<HTMLButtonElement>(".todo-group-tabs button");
    expect(activeTabsAfterClick[1].classList.contains("is-active")).toBe(true);
    expect(container.querySelector(".todo-group[data-group-id='tag-dev']")).not.toBeNull();
    expect(container.querySelector(".todo-group[data-group-id='untagged']")).not.toBeNull();

    // Switch to All grouping
    activeTabsAfterClick[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(localStorage.getItem("rook_todos_grouping")).toBe("all");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(container.querySelector(".todo-group[data-group-id='all']")).not.toBeNull();
    expect(container.querySelector(".todo-group-header")).toBeNull();

    // Clean up
    await noteService.delete(noteUntagged.id);
    await noteService.delete(noteTagged.id);
    localStorage.removeItem("rook_todos_grouping");
    container.remove();
  });

  it("keeps calendar popover open when navigating months", async () => {
    const { renderShell, renderToday } = await import("./main");

    const app = document.querySelector("#app");
    expect(app).not.toBeNull();
    await renderShell();

    const container = document.querySelector("#page-content") as HTMLElement;
    expect(container).not.toBeNull();
    await renderToday(container);

    const datePicker = container.querySelector<HTMLDetailsElement>(".date-picker");
    expect(datePicker).not.toBeNull();

    // Open the calendar
    datePicker?.setAttribute("open", "");
    expect(datePicker?.hasAttribute("open")).toBe(true);

    // Find previous month button
    const prevMonthBtn = container.querySelector<HTMLButtonElement>("[data-calendar-month]");
    expect(prevMonthBtn).not.toBeNull();

    // Click previous month button
    prevMonthBtn?.click();

    // Verify calendar details element remains open
    expect(datePicker?.hasAttribute("open")).toBe(true);
  });

  it("renders calendar popover within date-picker alongside note composer without falling back to editor", async () => {
    const { renderShell, renderToday } = await import("./main");

    const app = document.querySelector("#app");
    expect(app).not.toBeNull();
    await renderShell();

    const container = document.querySelector("#page-content") as HTMLElement;
    expect(container).not.toBeNull();
    await renderToday(container);

    const datePicker = container.querySelector<HTMLDetailsElement>(".date-picker.minimal-picker");
    expect(datePicker).not.toBeNull();

    const popover = datePicker?.querySelector<HTMLElement>(".date-picker-popover#notes-calendar");
    expect(popover).not.toBeNull();

    const composer = container.querySelector<HTMLElement>(".copilot-input-container");
    expect(composer).not.toBeNull();

    // Opening date picker keeps details open and popover visible
    datePicker?.setAttribute("open", "");
    expect(datePicker?.hasAttribute("open")).toBe(true);

    // Clicking inside the popover (e.g. legend or calendar grid) does not dismiss the picker
    const legend = popover?.querySelector(".calendar-legend");
    expect(legend).not.toBeNull();
    legend?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(datePicker?.hasAttribute("open")).toBe(true);

    // Verify currently selected date day element exists and is marked is-selected
    const selectedDay = popover?.querySelector<HTMLAnchorElement>(".calendar-day.is-selected");
    expect(selectedDay).not.toBeNull();
    expect(selectedDay?.hasAttribute("aria-current")).toBe(true);
    expect(selectedDay?.querySelector("span")?.textContent).toBeTruthy();
  });

  it("shifts focus to calendar summary when opening date picker via palette command", async () => {
    const { renderShell, renderToday, openSearch } = await import("./main");

    const app = document.querySelector("#app");
    expect(app).not.toBeNull();
    await renderShell();

    const container = document.querySelector("#page-content") as HTMLElement;
    expect(container).not.toBeNull();
    await renderToday(container);

    const datePicker = container.querySelector<HTMLDetailsElement>(".date-picker");
    expect(datePicker).not.toBeNull();
    const summary = datePicker?.querySelector("summary");
    expect(summary).not.toBeNull();

    // Focus composer textarea first as if user was typing a note
    const textarea = container.querySelector<HTMLTextAreaElement>("#new-note-form textarea");
    expect(textarea).not.toBeNull();
    textarea?.focus();
    expect(document.activeElement).toBe(textarea);

    // Trigger go-to-date command via command palette
    await openSearch(">go to date");
    const input = document.querySelector<HTMLInputElement>("#command-palette-input");
    expect(input).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));

    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    // Date picker should now be open and summary focused instead of remaining in note editor
    expect(datePicker?.hasAttribute("open")).toBe(true);
    expect(document.activeElement).toBe(summary);
  });

  it("embeds data management export and backup directly into Settings and handles /data redirect", async () => {
    const { renderSettings, renderData } = await import("./main");

    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderSettings(container);

    const dataSection = container.querySelector("#data-management-section");
    expect(dataSection).not.toBeNull();

    const dirExportBtn = dataSection?.querySelector("#directory-export");
    const zipExportBtn = dataSection?.querySelector("#zip-export");
    const backupBtn = dataSection?.querySelector("#create-backup");
    const restoreInput = dataSection?.querySelector("#restore-backup");

    expect(dirExportBtn).not.toBeNull();
    expect(zipExportBtn).not.toBeNull();
    expect(backupBtn).not.toBeNull();
    expect(restoreInput).not.toBeNull();

    // Verify calling renderData redirects into settings
    await renderData(container);
    expect(container.querySelector("#data-management-section")).not.toBeNull();
    container.remove();
  });

  it("redirects /search to / and triggers command palette search", async () => {
    const { renderSearch } = await import("./main");

    const container = document.createElement("div");
    document.body.appendChild(container);

    history.pushState({}, "", "/search?q=journal");
    await renderSearch(container);

    // Should redirect history path to /
    expect(window.location.pathname).toBe("/");

    container.remove();
  });

  it("renders not found page for removed /categories route", async () => {
    const { renderRoute, renderShell } = await import("./main");
    await renderShell();

    history.pushState({}, "", "/categories");
    await renderRoute();

    const content = document.querySelector("#page-content");
    expect(content?.textContent).toMatch(/404|That page does not exist|Bu sayfa mevcut değil/);
  });

  it("inserts pre-defined template into empty editor directly", async () => {
    const { renderShell, insertTemplateIntoEditor } = await import("./main");
    const { getTemplateById } = await import("./templates");

    history.pushState({}, "", "/");
    await renderShell();

    const textarea = document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")!;
    textarea.value = "";

    const standup = getTemplateById("standup");
    expect(standup).toBeDefined();

    await insertTemplateIntoEditor(standup!.markdown);

    expect(textarea.value).toContain("Daily Standup");
    expect(textarea.value).toContain("#standup");
    expect(textarea.closest("#new-note-form")?.classList.contains("has-content")).toBe(true);
  });

  it("shows confirmation dialog and replaces text when editor already has content", async () => {
    const { renderShell, insertTemplateIntoEditor } = await import("./main");
    const { getTemplateById } = await import("./templates");

    history.pushState({}, "", "/");
    await renderShell();

    const textarea = document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")!;
    textarea.value = "My original draft text that should warn before replace";

    const standup = getTemplateById("standup");
    expect(standup).toBeDefined();

    await insertTemplateIntoEditor(standup!.markdown);

    // Confirmation dialog is displayed
    const confirmDialog = document.querySelector("#confirm-backdrop");
    expect(confirmDialog).not.toBeNull();
    expect(document.querySelector("#confirm-title")?.textContent).toMatch(/Replace note with template\?|Not şablonla değiştirilsin mi\?/);

    // Textarea still has original text before confirming
    expect(textarea.value).toBe("My original draft text that should warn before replace");

    // Click confirm replace button
    const confirmBtn = document.querySelector<HTMLButtonElement>("#confirm-action");
    confirmBtn?.click();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(textarea.value).toContain("Daily Standup");
    expect(textarea.value).toContain("#standup");
    expect(textarea.value).not.toContain("My original draft text");
  });

  it("opens template picker and inserts template on item click", async () => {
    const { renderShell } = await import("./main");
    history.pushState({}, "", "/");
    await renderShell();

    const textarea = document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")!;
    textarea.value = "";

    const picker = document.querySelector<HTMLDetailsElement>(".editor-template-picker");
    expect(picker).not.toBeNull();

    // Click standup template item
    const standupBtn = picker?.querySelector<HTMLButtonElement>("[data-insert-template='standup']");
    expect(standupBtn).not.toBeNull();
    standupBtn?.click();

    expect(textarea.value).toContain("Daily Standup");
    expect(textarea.value).toContain("#standup");
  });

  it("renders wikilinks inside notes and navigates via SPA link", async () => {
    const noteService = new NoteService(new NoteRepository());
    const targetDate = "2026-09-15";
    const sourceDate = "2026-09-16";

    const note = await noteService.create(`Reference to [[${targetDate}|September specs]].`, sourceDate);

    const { renderRoute, renderShell } = await import("./main");
    history.pushState({}, "", `/?date=${sourceDate}`);
    await renderShell();

    const wikilink = document.querySelector<HTMLAnchorElement>(".wikilink-date");
    expect(wikilink).not.toBeNull();
    expect(wikilink?.textContent).toBe("September specs");
    expect(wikilink?.getAttribute("href")).toContain(targetDate);

    // Clicking the wikilink navigates via SPA to target date
    wikilink?.click();
    await renderRoute();

    expect(window.location.search).toContain(`date=${targetDate}`);

    await noteService.delete(note.id);
  });

  it("displays bidirectional backlinks and day mentions", async () => {
    const noteService = new NoteService(new NoteRepository());
    const date1 = "2026-08-10";
    const date2 = "2026-08-11";

    const note1 = await noteService.create("Core architectural design decisions", date1);
    const note2 = await noteService.create(`Continuation of [[${date1}]] architecture`, date2);

    const { renderRoute, renderShell } = await import("./main");
    history.pushState({}, "", `/?date=${date1}`);
    await renderShell();
    await renderRoute();

    // Day mentions panel is displayed for date1
    const mentionsPanel = document.querySelector(".day-mentions-panel");
    expect(mentionsPanel).not.toBeNull();
    expect(mentionsPanel?.textContent).toContain("Continuation of");
    expect(mentionsPanel?.querySelector(".day-mention-snippet-rendered .wikilink")).not.toBeNull();

    await noteService.delete(note1.id);
    await noteService.delete(note2.id);
  });

  it("opens link picker modal when clicking toolbar backlink button and inserts selected note", async () => {
    const noteService = new NoteService(new NoteRepository());
    const note = await noteService.create("Sprint Planning Kickoff", "2026-10-01");

    const { renderShell } = await import("./main");
    history.pushState({}, "", "/");
    await renderShell();

    const textarea = document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")!;
    textarea.value = "Reviewing ";
    textarea.setSelectionRange(10, 10);

    const wikilinkBtn = document.querySelector<HTMLButtonElement>("#new-note-form button[data-format='wikilink']");
    expect(wikilinkBtn).not.toBeNull();

    wikilinkBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Link picker dialog is mounted in #dialog-host
    const dialog = document.querySelector(".link-picker-dialog");
    expect(dialog).not.toBeNull();

    // Search input is focused
    const searchInput = document.querySelector<HTMLInputElement>("#link-picker-search");
    expect(searchInput).not.toBeNull();

    // Results show the Sprint Planning Kickoff note with rendered inline markdown
    const item = document.querySelector<HTMLButtonElement>(".link-picker-row[data-target='Sprint Planning Kickoff']");
    expect(item).not.toBeNull();
    expect(item?.querySelector(".link-picker-row-text.prose")).not.toBeNull();

    // Click the item to insert
    item?.click();

    expect(textarea.value).toBe("Reviewing [[Sprint Planning Kickoff]] ");
    expect(document.querySelector(".link-picker-dialog")).toBeNull();

    await noteService.delete(note.id);
  });

  it("opens link picker modal when typing [[ inline in the editor", async () => {
    const noteService = new NoteService(new NoteRepository());
    const note = await noteService.create("Project Alpha Specifications", "2026-10-01");

    const { renderShell } = await import("./main");
    history.pushState({}, "", "/");
    await renderShell();

    const textarea = document.querySelector<HTMLTextAreaElement>("#new-note-form textarea")!;
    textarea.value = "Working on [[";
    textarea.setSelectionRange(13, 13);
    textarea.dispatchEvent(new Event("input"));

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Link picker dialog is mounted in #dialog-host without any blocking floating dropdown
    const dialog = document.querySelector(".link-picker-dialog");
    expect(dialog).not.toBeNull();

    // Verify there is no wikilink-autocomplete-dropdown in the DOM
    expect(document.querySelector(".wikilink-autocomplete-dropdown")).toBeNull();

    // Click the item to insert
    const item = document.querySelector<HTMLButtonElement>(".link-picker-row[data-target='Project Alpha Specifications']");
    expect(item).not.toBeNull();
    item?.click();

    expect(textarea.value).toBe("Working on [[Project Alpha Specifications]] ");

    await noteService.delete(note.id);
  });

  it("translates link picker badges, sections, and hints into Turkish", async () => {
    const noteService = new NoteService(new NoteRepository());
    const note = await noteService.create("Mimari Notları", "2026-10-01");

    const { renderShell } = await import("./main");
    const { setLocale } = await import("./i18n");
    setLocale("tr");

    history.pushState({}, "", "/");
    await renderShell();

    const wikilinkBtn = document.querySelector<HTMLButtonElement>("#new-note-form button[data-format='wikilink']");
    wikilinkBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const dialog = document.querySelector(".link-picker-dialog");
    expect(dialog).not.toBeNull();

    // Sections are translated to Turkish
    const sectionLabels = Array.from(dialog?.querySelectorAll(".link-picker-section-label") ?? []).map((el) => el.textContent);
    expect(sectionLabels).toContain("Tarihler");
    expect(sectionLabels).toContain("Notlar");

    // Today badge is translated to Bugün
    const todayBadge = dialog?.querySelector(".link-picker-row-badge.is-date");
    expect(todayBadge?.textContent).toBe("Bugün");

    // Footer hint is translated to Turkish
    const footerHint = dialog?.querySelector(".link-picker-hint");
    expect(footerHint?.textContent).toContain("gezinmek için");
    expect(footerHint?.textContent).toContain("eklemek için");

    // Close dialog and reset locale
    const closeBtn = dialog?.querySelector<HTMLButtonElement>("[data-close-dialog]");
    closeBtn?.click();
    setLocale("en");

    await noteService.delete(note.id);
  });

  it("translates formatting toolbar, templates, calendar, and command palette into Turkish", async () => {
    const { renderShell } = await import("./main");
    const { setLocale } = await import("./i18n");
    setLocale("tr");

    history.pushState({}, "", "/");
    await renderShell();

    // Toolbar buttons are localized into Turkish
    const boldBtn = document.querySelector<HTMLButtonElement>("button[data-format='bold']");
    expect(boldBtn?.getAttribute("aria-label")).toBe("Kalın");
    expect(boldBtn?.getAttribute("title")).toBe("Kalın");

    const italicBtn = document.querySelector<HTMLButtonElement>("button[data-format='italic']");
    expect(italicBtn?.getAttribute("aria-label")).toBe("İtalik");

    const templateTrigger = document.querySelector<HTMLElement>(".editor-template-btn");
    expect(templateTrigger?.getAttribute("aria-label")).toBe("Şablonlar");

    // Template menu shows Turkish template items
    const standupTmpl = document.querySelector<HTMLButtonElement>("button[data-insert-template='standup']");
    expect(standupTmpl?.textContent).toContain("Günlük Standup");
    expect(standupTmpl?.textContent).toContain("Dün, bugün ve engelleyicileri takip edin");

    // Calendar legend is localized
    const legend = document.querySelector(".calendar-legend");
    expect(legend?.textContent).toContain("Notu olan gün");
    expect(legend?.textContent).toContain("Haftalık toplamlar sağda");

    // Command palette placeholder is localized
    const paletteInput = document.querySelector<HTMLInputElement>("#command-palette-input");
    expect(paletteInput?.placeholder).toBe("Notlarda arayın veya komutlar için > yazın");

    setLocale("en");
  });

  it("opens link picker modal from edit note dialog toolbar and inserts wikilink without closing edit dialog", async () => {
    const noteService = new NoteService(new NoteRepository());
    const targetNote = await noteService.create("Reference Target Note", "2026-10-02");
    const editableNote = await noteService.create("Original Edit Content", "2026-10-04");

    const { renderShell, showEditDialog } = await import("./main");
    history.pushState({}, "", "/");
    await renderShell();

    // Open edit dialog
    showEditDialog(editableNote);

    const editDialogBackdrop = document.querySelector("#edit-note-backdrop");
    expect(editDialogBackdrop).not.toBeNull();

    const form = document.querySelector<HTMLFormElement>("#edit-note-form");
    expect(form).not.toBeNull();
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;
    expect(textarea).not.toBeNull();
    textarea.value = "See ";
    textarea.setSelectionRange(4, 4);

    // Click wikilink button in the edit dialog toolbar
    const wikilinkBtn = form?.querySelector<HTMLButtonElement>("button[data-format='wikilink']");
    expect(wikilinkBtn).not.toBeNull();

    wikilinkBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Link picker dialog is mounted on top of the edit dialog
    const linkPickerDialog = document.querySelector(".link-picker-dialog");
    expect(linkPickerDialog).not.toBeNull();

    // Edit dialog backdrop is STILL in the DOM
    expect(document.querySelector("#edit-note-backdrop")).not.toBeNull();

    // Select the candidate note
    const candidateRow = document.querySelector<HTMLButtonElement>(".link-picker-row[data-target='Reference Target Note']");
    expect(candidateRow).not.toBeNull();
    candidateRow?.click();

    // Link picker dialog is closed
    expect(document.querySelector(".link-picker-dialog")).toBeNull();

    // Edit note dialog is STILL open
    expect(document.querySelector("#edit-note-backdrop")).not.toBeNull();
    expect(document.querySelector("#edit-note-form")).not.toBeNull();

    // Textarea has the inserted wikilink
    expect(textarea.value).toBe("See [[Reference Target Note]] ");

    // Submit edit note form
    form?.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Now edit dialog is closed
    expect(document.querySelector("#edit-note-backdrop")).toBeNull();

    // Verify persisted note
    const updated = (await noteService.listAll()).find((n) => n.id === editableNote.id);
    expect(updated?.content).toBe("See [[Reference Target Note]]");

    await noteService.delete(targetNote.id);
    await noteService.delete(editableNote.id);
  });

  it("opens link picker modal when typing [[ in edit note dialog and preserves edit dialog on cancel", async () => {
    const noteService = new NoteService(new NoteRepository());
    const editableNote = await noteService.create("Initial note text", "2026-10-04");

    const { renderShell, showEditDialog } = await import("./main");
    history.pushState({}, "", "/");
    await renderShell();

    showEditDialog(editableNote);
    const form = document.querySelector<HTMLFormElement>("#edit-note-form");
    const textarea = form?.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea")!;

    textarea.value = "Typing [[";
    textarea.setSelectionRange(9, 9);
    textarea.dispatchEvent(new Event("input"));

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Link picker is open
    expect(document.querySelector(".link-picker-dialog")).not.toBeNull();
    // Edit dialog is still open underneath
    expect(document.querySelector("#edit-note-backdrop")).not.toBeNull();

    // Press Escape to cancel link picker
    const escEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(escEvent);

    // Link picker is closed
    expect(document.querySelector(".link-picker-dialog")).toBeNull();

    // Edit dialog remains open and intact
    expect(document.querySelector("#edit-note-backdrop")).not.toBeNull();

    // Clean up
    const cancelBtn = document.querySelector<HTMLButtonElement>("#edit-note-form [data-close-dialog]");
    cancelBtn?.click();
    expect(document.querySelector("#edit-note-backdrop")).toBeNull();

    await noteService.delete(editableNote.id);
  });

  it("closes edit note dialog and navigates when clicking internal wikilink in preview mode", async () => {
    const noteService = new NoteService(new NoteRepository());
    const targetNote = await noteService.create("Target Note Description", "2026-10-01");
    const noteWithWikilink = await noteService.create("Reference to [[2026-10-01]].", "2026-10-04");

    const { renderShell, showEditDialog } = await import("./main");
    history.pushState({}, "", "/");
    await renderShell();

    showEditDialog(noteWithWikilink);
    const form = document.querySelector<HTMLFormElement>("#edit-note-form")!;

    // Switch to preview mode
    const previewBtn = form.querySelector<HTMLButtonElement>("[data-editor-mode='preview']")!;
    previewBtn.click();

    const previewPane = form.querySelector<HTMLElement>(".editor-preview")!;
    expect(previewPane.classList.contains("is-hidden")).toBe(false);

    // Wikilink is rendered in preview
    const wikilink = previewPane.querySelector<HTMLAnchorElement>("a.wikilink");
    expect(wikilink).not.toBeNull();
    expect(wikilink?.getAttribute("href")).toContain("2026-10-01");

    // Click the wikilink
    wikilink?.click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Edit dialog MUST be closed
    expect(document.querySelector("#edit-note-backdrop")).toBeNull();

    // Route should be on target date
    expect(location.search).toContain("date=2026-10-01");

    await noteService.delete(targetNote.id);
    await noteService.delete(noteWithWikilink.id);
  });

  it("renders external link with target=_blank in preview mode and clicking header date badge navigates", async () => {
    const noteService = new NoteService(new NoteRepository());
    const noteWithExternal = await noteService.create("Check [Website](https://example.com) for updates.", "2026-05-15");

    const { renderShell, showEditDialog } = await import("./main");
    history.pushState({}, "", "/");
    await renderShell();

    showEditDialog(noteWithExternal);
    const dialog = document.querySelector(".note-edit-dialog");
    expect(dialog).not.toBeNull();

    // Verify date badge in header is a link with href
    const dateBadge = dialog?.querySelector<HTMLAnchorElement>(".note-edit-date-badge");
    expect(dateBadge).not.toBeNull();
    expect(dateBadge?.tagName).toBe("A");
    expect(dateBadge?.getAttribute("href")).toContain("2026-05-15");

    // Switch to preview mode
    const previewBtn = dialog?.querySelector<HTMLButtonElement>("[data-editor-mode='preview']")!;
    previewBtn.click();

    const previewPane = dialog?.querySelector<HTMLElement>(".editor-preview")!;
    const externalLink = previewPane.querySelector<HTMLAnchorElement>("a[target='_blank']");
    expect(externalLink).not.toBeNull();
    expect(externalLink?.getAttribute("href")).toBe("https://example.com");
    expect(externalLink?.getAttribute("rel")).toContain("noopener");

    // Click the header date badge
    dateBadge?.click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Edit dialog closed and navigated
    expect(document.querySelector("#edit-note-backdrop")).toBeNull();
    expect(location.search).toContain("date=2026-05-15");

    await noteService.delete(noteWithExternal.id);
  });

  it("applies the v2 warm monochrome theme-color meta tag on shell render", async () => {
    const metaEl = document.createElement("meta");
    metaEl.name = "theme-color";
    metaEl.content = "#FFFFFF";
    document.head.appendChild(metaEl);

    localStorage.setItem("theme-preference", "LIGHT");
    const { renderShell } = await import("./main");
    await renderShell();

    expect(metaEl.getAttribute("content")).toBe("#FBFBFA");
    expect(document.documentElement.dataset.theme).toBe("light");

    localStorage.setItem("theme-preference", "DARK");
    await renderShell();
    expect(metaEl.getAttribute("content")).toBe("#121214");
    expect(document.documentElement.dataset.theme).toBe("dark");

    metaEl.remove();
  });
});
