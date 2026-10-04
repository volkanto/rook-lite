import { currentStrings } from "../i18n";
import type { Category, Note } from "../models";
import { normalize } from "../services";
import { getRecentCommands, recordCommandUse } from "./commandHistory";
import { createCommandRegistry } from "./commandRegistry";
import { searchPalette } from "./commandSearch";
import { insertFilterValue, parseSearchQuery } from "./searchParser";
import type {
  Command,
  CommandActions,
  CommandContext,
  PaletteCommandItem,
  PaletteItem,
  PaletteNoteItem,
  PaletteSection,
  PaletteSuggestionItem,
  PaletteTaskItem
} from "./types";

export interface CommandPaletteOptions {
  hostElement: HTMLElement;
  getNotes: () => Promise<Note[]>;
  getCategories: () => Promise<Category[]>;
  getContext: () => CommandContext;
  actions: CommandActions;
  onNavigate?: (url: string) => void;
}

export class CommandPaletteController {
  private host: HTMLElement;
  private input!: HTMLInputElement;
  private resultsContainer!: HTMLElement;
  private footerContainer!: HTMLElement;
  private commands: Command[];
  private sections: PaletteSection[] = [];
  private flattenedItems: PaletteItem[] = [];
  private selectedIndex = 0;
  private openState = false;
  private previousActiveElement: HTMLElement | null = null;
  private options: CommandPaletteOptions;
  private cachedNotes: Note[] = [];
  private cachedCategories: Category[] = [];

  constructor(options: CommandPaletteOptions) {
    this.options = options;
    this.host = options.hostElement;
    this.commands = createCommandRegistry(options.actions);
    this.buildDom();
    this.bindEvents();
  }

  private buildDom(): void {
    const s = currentStrings();
    this.host.innerHTML = `
      <div class="modal-content command-palette" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div class="palette-header">
          <div class="palette-search-field">
            <span class="palette-search-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
            </span>
            <input
              type="text"
              class="palette-input"
              id="command-palette-input"
              placeholder="${s.palettePlaceholder}"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="palette-results-list"
            />
            <span class="palette-badge-hint" aria-hidden="true">esc</span>
          </div>
        </div>
        <div class="palette-body" id="palette-results-list" role="listbox" aria-label="Suggestions and search results"></div>
        <div class="palette-footer">
          <div class="palette-footer-actions">
            <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> ${s.paletteNavHint}</span>
            <span><kbd>&crarr;</kbd> ${s.paletteSelectHint}</span>
            <span><kbd>esc</kbd> ${s.paletteCloseHint}</span>
          </div>
          <div class="palette-footer-mode" id="palette-footer-mode">
            <span>${s.paletteCommandsHint}</span>
          </div>
        </div>
      </div>
    `;

    this.input = this.host.querySelector<HTMLInputElement>("#command-palette-input")!;
    this.resultsContainer = this.host.querySelector<HTMLElement>("#palette-results-list")!;
    this.footerContainer = this.host.querySelector<HTMLElement>("#palette-footer-mode")!;
  }

  private bindEvents(): void {
    this.host.addEventListener("click", (event) => {
      if (event.target === this.host) {
        this.close();
      }
    });

    this.input.addEventListener("input", () => {
      void this.renderResults();
    });

    this.input.addEventListener("keydown", (event) => {
      this.handleKeydown(event);
    });

    this.resultsContainer.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-palette-index]");
      if (target) {
        const index = Number(target.dataset.paletteIndex);
        if (!isNaN(index) && this.flattenedItems[index]) {
          this.selectedIndex = index;
          void this.executeSelected();
        }
      }
    });

    this.resultsContainer.addEventListener("mousemove", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-palette-index]");
      if (target) {
        const index = Number(target.dataset.paletteIndex);
        if (!isNaN(index) && index !== this.selectedIndex) {
          this.selectedIndex = index;
          this.updateActiveItemVisuals();
        }
      }
    });
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!this.flattenedItems.length) return;
      this.selectedIndex = (this.selectedIndex + 1) % this.flattenedItems.length;
      this.updateActiveItemVisuals();
      this.scrollActiveIntoView();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.flattenedItems.length) return;
      this.selectedIndex = (this.selectedIndex - 1 + this.flattenedItems.length) % this.flattenedItems.length;
      this.updateActiveItemVisuals();
      this.scrollActiveIntoView();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void this.executeSelected();
      return;
    }

    if (event.key === "Tab") {
      const selected = this.flattenedItems[this.selectedIndex];
      if (selected && selected.type === "suggestion") {
        event.preventDefault();
        void this.executeSelected();
      }
    }
  }

  private updateActiveItemVisuals(): void {
    const items = this.resultsContainer.querySelectorAll<HTMLElement>(".palette-item");
    items.forEach((item, idx) => {
      const isSelected = idx === this.selectedIndex;
      item.classList.toggle("is-active", isSelected);
      item.setAttribute("aria-selected", String(isSelected));
    });

    if (this.flattenedItems[this.selectedIndex]) {
      this.input.setAttribute("aria-activedescendant", `palette-item-${this.selectedIndex}`);
    } else {
      this.input.removeAttribute("aria-activedescendant");
    }
  }

  private scrollActiveIntoView(): void {
    const activeEl = this.resultsContainer.querySelector<HTMLElement>(".palette-item.is-active");
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }

  public async open(initialQuery = ""): Promise<void> {
    if (this.openState) return;
    this.openState = true;
    this.previousActiveElement = document.activeElement as HTMLElement | null;

    this.host.classList.add("is-open");
    this.host.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Refresh data in background
    try {
      const [notes, categories] = await Promise.all([
        this.options.getNotes(),
        this.options.getCategories()
      ]);
      this.cachedNotes = notes;
      this.cachedCategories = categories;
    } catch {
      // Continue with current cache if error
    }

    this.input.value = initialQuery;
    this.selectedIndex = 0;
    this.input.setAttribute("aria-expanded", "true");
    this.input.focus();
    if (initialQuery) {
      this.input.select();
    }

    await this.renderResults();
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;

    this.host.classList.remove("is-open");
    this.host.setAttribute("aria-hidden", "true");
    this.input.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === "function") {
      this.previousActiveElement.focus();
    }
  }

  public isOpen(): boolean {
    return this.openState;
  }

  private async renderResults(): Promise<void> {
    const query = this.input.value;
    const context = this.options.getContext();
    const recent = getRecentCommands();

    this.sections = searchPalette(
      query,
      this.commands,
      recent,
      this.cachedNotes,
      this.cachedCategories,
      context
    );

    this.flattenedItems = this.sections.flatMap((s) => s.items);
    if (this.selectedIndex >= this.flattenedItems.length) {
      this.selectedIndex = 0;
    }

    // Update footer mode indicator
    const trimmed = query.trim();
    if (trimmed.startsWith(">")) {
      this.footerContainer.innerHTML = `<span class="mode-tag-command">Command Mode</span>`;
    } else if (parsedHasFilter(query)) {
      this.footerContainer.innerHTML = `<span class="mode-tag-filter">Filtered Search</span>`;
    } else {
      this.footerContainer.innerHTML = `<span>Type <kbd>&gt;</kbd> for commands</span>`;
    }

    if (!this.flattenedItems.length) {
      this.resultsContainer.innerHTML = `
        <div class="palette-empty-state">
          <p class="palette-empty-title">No matching notes or commands</p>
          <span class="palette-empty-sub">Try searching for keywords or type <kbd>&gt;</kbd> to browse commands</span>
        </div>
      `;
      return;
    }

    let itemIndexCounter = 0;
    const parsed = parseSearchQuery(query);
    const highlightTerm = parsed.text;

    const sectionsHtml = this.sections
      .filter((section) => section.items.length > 0)
      .map((section) => {
        const header = `<div class="palette-group-title">${escapeHtml(section.title)}</div>`;
        const itemsHtml = section.items
          .map((item) => {
            const currentIndex = itemIndexCounter++;
            const isSelected = currentIndex === this.selectedIndex;
            return this.renderItem(item, currentIndex, isSelected, highlightTerm);
          })
          .join("");

        return `<div class="palette-group">${header}<div class="palette-group-items">${itemsHtml}</div></div>`;
      })
      .join("");

    this.resultsContainer.innerHTML = sectionsHtml;
    this.updateActiveItemVisuals();
  }

  private renderItem(item: PaletteItem, index: number, isSelected: boolean, highlightTerm: string): string {
    const activeClass = isSelected ? "is-active" : "";

    switch (item.type) {
      case "command": {
        const cmdItem = item as PaletteCommandItem;
        const shortcutHtml = cmdItem.shortcut
          ? `<kbd class="palette-item-shortcut">${escapeHtml(cmdItem.shortcut)}</kbd>`
          : "";
        return `
          <div
            class="palette-item palette-command-item ${activeClass}"
            id="palette-item-${index}"
            role="option"
            aria-selected="${isSelected}"
            data-palette-index="${index}"
          >
            <div class="palette-item-icon palette-command-glyph">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
            <div class="palette-item-content">
              <span class="palette-item-title">${highlightText(cmdItem.title, highlightTerm)}</span>
              ${cmdItem.description ? `<span class="palette-item-desc">${escapeHtml(cmdItem.description)}</span>` : ""}
            </div>
            ${shortcutHtml}
          </div>
        `;
      }

      case "note": {
        const noteItem = item as PaletteNoteItem;
        const tagsHtml = noteItem.tags.length
          ? `<span class="palette-note-tags">${noteItem.tags.slice(0, 3).map((t) => `#${escapeHtml(t)}`).join(" ")}</span>`
          : "";
        const catHtml = noteItem.categoryName
          ? `<span class="palette-note-cat">${escapeHtml(noteItem.categoryName)}</span>`
          : "";
        const taskBadgeHtml = noteItem.openTaskCount > 0
          ? `<span class="palette-task-count-badge">${noteItem.openTaskCount} ${noteItem.openTaskCount === 1 ? "task" : "tasks"}</span>`
          : "";

        return `
          <div
            class="palette-item palette-note-item ${activeClass}"
            id="palette-item-${index}"
            role="option"
            aria-selected="${isSelected}"
            data-palette-index="${index}"
          >
            <div class="palette-item-icon palette-note-glyph">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="palette-item-content">
              <div class="palette-note-head">
                <span class="palette-note-title">${highlightText(noteItem.title, highlightTerm)}</span>
                <span class="palette-note-meta">${formatDisplayDate(noteItem.noteDate)}${catHtml ? ` · ${catHtml}` : ""}${tagsHtml ? ` · ${tagsHtml}` : ""}</span>
              </div>
              ${noteItem.contentExcerpt ? `<p class="palette-note-excerpt">${highlightText(noteItem.contentExcerpt, highlightTerm)}</p>` : ""}
            </div>
            ${taskBadgeHtml}
          </div>
        `;
      }

      case "task": {
        const taskItem = item as PaletteTaskItem;
        const catHtml = taskItem.categoryName
          ? `<span class="palette-note-cat">${escapeHtml(taskItem.categoryName)}</span>`
          : "";
        return `
          <div
            class="palette-item palette-task-item ${activeClass}"
            id="palette-item-${index}"
            role="option"
            aria-selected="${isSelected}"
            data-palette-index="${index}"
          >
            <div class="palette-item-icon palette-task-glyph">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </div>
            <div class="palette-item-content">
              <span class="palette-item-title">${highlightText(taskItem.taskText, highlightTerm)}</span>
              <span class="palette-note-meta">${formatDisplayDate(taskItem.noteDate)}${catHtml ? ` · ${catHtml}` : ""}</span>
            </div>
          </div>
        `;
      }

      case "suggestion": {
        const sugItem = item as PaletteSuggestionItem;
        const countHtml = sugItem.count ? `<span class="palette-suggestion-count">${sugItem.count}</span>` : "";
        return `
          <div
            class="palette-item palette-suggestion-item ${activeClass}"
            id="palette-item-${index}"
            role="option"
            aria-selected="${isSelected}"
            data-palette-index="${index}"
          >
            <div class="palette-item-icon palette-suggestion-glyph">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
            </div>
            <div class="palette-item-content">
              <span class="palette-item-title">${escapeHtml(sugItem.label)}</span>
            </div>
            ${countHtml}
          </div>
        `;
      }
    }
  }

  private async executeSelected(): Promise<void> {
    const item = this.flattenedItems[this.selectedIndex];
    if (!item) return;

    if (item.type === "suggestion") {
      const sug = item as PaletteSuggestionItem;
      const updated = insertFilterValue(this.input.value, sug.filterType, sug.value);
      this.input.value = updated;
      this.selectedIndex = 0;
      this.input.focus();
      await this.renderResults();
      return;
    }

    // For all navigational or executable actions, close the palette first
    this.close();

    if (item.type === "command") {
      const cmdItem = item as PaletteCommandItem;
      recordCommandUse(cmdItem.id);
      const context = this.options.getContext();
      await cmdItem.command.execute(context);
      return;
    }

    if (item.type === "note") {
      const noteItem = item as PaletteNoteItem;
      if (this.options.onNavigate) {
        this.options.onNavigate(noteItem.href);
      } else {
        location.href = noteItem.href;
      }
      return;
    }

    if (item.type === "task") {
      const taskItem = item as PaletteTaskItem;
      if (this.options.onNavigate) {
        this.options.onNavigate(taskItem.href);
      } else {
        location.href = taskItem.href;
      }
      return;
    }
  }

  public destroy(): void {
    this.close();
    this.host.innerHTML = "";
  }
}

function parsedHasFilter(query: string): boolean {
  return /(?:tag|category|has|after|before):/i.test(query);
}

function highlightText(text: string, term: string): string {
  if (!text) return "";
  if (!term || !term.trim()) return escapeHtml(text);

  const escapedTerm = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedTerm})`, "gi");

  const parts = text.split(regex);
  return parts
    .map((part) => {
      if (normalize(part) === normalize(term.trim())) {
        return `<mark class="palette-highlight">${escapeHtml(part)}</mark>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${monthNames[mIndex] ?? parts[1]} ${day}`;
}
