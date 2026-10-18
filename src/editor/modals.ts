import { track } from "../analytics/analytics";
import { icons, svg } from "../icons";
import { currentStrings, formatDateHeading } from "../i18n";
import { buildWikilinkInsertion, getLinkPickerCandidates } from "../link-picker";
import { escapeHtml, renderInlineMarkdown } from "../markdown";
import type { Folder, Note } from "../models";
import { appUrl } from "../routing";
import { folders, notes } from "../servicesContext";
import { attachTagAutocomplete } from "../tag-autocomplete";
import { tagCounts } from "../utils/date";
import { errorMessage, requireElement, setBusy, status } from "../utils/dom";
import { setWikilinkNotesIndex } from "../wikilinks";
import { renderRoute } from "../router";
import { bindFormatting } from "./formatting";
import { bindEditorPreview, editorMarkup, resizeEditor, toggleZenMode, updateEditorWordCount } from "./toolbar";

export type CalendarRefresher = () => Promise<void>;
let activeCalendarRefresher: CalendarRefresher | null = null;
export function setCalendarRefresher(refresher: CalendarRefresher): void {
  activeCalendarRefresher = refresher;
}

async function triggerCalendarRefresh(): Promise<void> {
  if (activeCalendarRefresher) {
    await activeCalendarRefresher();
  }
}

export function closeDialog(target?: Element | null): void {
  const host = document.querySelector<HTMLElement>("#dialog-host");
  if (!host) return;
  if (target !== undefined) {
    if (target && host.contains(target)) {
      const backdrop = target.classList.contains("note-edit-backdrop")
        ? target
        : target.closest(".note-edit-backdrop");
      if (backdrop) {
        backdrop.remove();
      } else {
        target.remove();
      }
    }
  } else if (host.lastElementChild) {
    host.lastElementChild.remove();
  } else {
    host.replaceChildren();
  }

  if (host.children.length === 0) {
    document.body.style.overflow = "";
    if (document.body.classList.contains("is-zen-mode")) {
      toggleZenMode();
    }
  }
}

export function closeAllDialogs(): void {
  const host = document.querySelector<HTMLElement>("#dialog-host");
  if (host) host.replaceChildren();
  document.body.style.overflow = "";
  if (document.body.classList.contains("is-zen-mode")) {
    toggleZenMode();
  }
}

export function showConfirm(title: string, message: string, actionLabel: string, action: () => Promise<void>): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop confirm-backdrop";
  backdrop.id = "confirm-backdrop";
  backdrop.innerHTML = `<section class="note-edit-dialog lite-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><header class="note-edit-dialog-head"><div class="confirm-title-group"><span class="confirm-alert-icon-wrap" aria-hidden="true">${svg(icons.alert, "confirm-alert-svg")}</span><h2 id="confirm-title">${escapeHtml(title)}</h2></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}">${svg(icons.close, "dialog-close-svg")}</button></header><div class="confirm-dialog-body"><p class="confirm-dialog-message">${escapeHtml(message)}</p></div><footer class="confirm-dialog-footer"><button type="button" class="btn-secondary" data-close-dialog>${s.cancel}</button><button type="button" class="btn-danger-confirm" id="confirm-action">${escapeHtml(actionLabel)}</button></footer></section>`;
  host.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const closeConfirm = () => {
    window.removeEventListener("keydown", onKeydown);
    closeDialog(backdrop);
  };

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      event.preventDefault();
      event.stopPropagation();
      closeConfirm();
    }
  });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeConfirm();
    }
  };
  window.addEventListener("keydown", onKeydown);

  backdrop.querySelector<HTMLButtonElement>("#confirm-action")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      await action();
      closeConfirm();
    } catch (error) {
      button.disabled = false;
      alert(errorMessage(error));
    }
  });
}

export function showFolderModal(options: {
  mode: "create" | "rename";
  folder?: Folder;
  onSave: (name: string) => Promise<void>;
}): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const isCreate = options.mode === "create";
  const title = isCreate ? s.createFolder : s.renameFolder;
  const initialValue = options.folder?.name ?? "";
  const actionLabel = isCreate ? s.createFolder : s.saveChanges;

  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop folder-modal-backdrop";
  backdrop.id = "folder-modal-backdrop";
  backdrop.innerHTML = `<section class="folder-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title"><form id="folder-modal-form" class="folder-modal-form"><header class="folder-modal-head"><div class="folder-modal-title-group"><span class="folder-modal-icon" aria-hidden="true">${svg(icons.folder, "folder-modal-svg")}</span><h2 id="folder-dialog-title">${escapeHtml(title)}</h2></div><button type="button" class="folder-modal-close" data-close-dialog aria-label="${s.closeEditor}">${svg(icons.close, "folder-close-svg")}</button></header><div class="folder-modal-body"><label for="folder-modal-name-input" class="folder-modal-label">${escapeHtml(s.folderNamePlaceholder)}</label><input type="text" id="folder-modal-name-input" name="folderName" class="folder-modal-input" value="${escapeHtml(initialValue)}" placeholder="${escapeHtml(s.folderNamePlaceholder)}" required maxlength="60" autocomplete="off" spellcheck="false" /><p class="folder-modal-error text-danger" id="folder-modal-error" hidden></p></div><footer class="folder-modal-footer"><button type="button" class="folder-modal-btn btn-ghost" data-close-dialog>${s.cancel}</button><button type="submit" class="folder-modal-btn btn-save" id="folder-modal-save">${escapeHtml(actionLabel)}</button></footer></form></section>`;
  host.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const closeModal = () => {
    window.removeEventListener("keydown", onKeydown);
    closeDialog(backdrop);
  };

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    }
  });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    }
  };
  window.addEventListener("keydown", onKeydown);

  const input = backdrop.querySelector<HTMLInputElement>("#folder-modal-name-input")!;
  const errorEl = backdrop.querySelector<HTMLElement>("#folder-modal-error")!;
  const form = backdrop.querySelector<HTMLFormElement>("#folder-modal-form")!;
  const submitBtn = backdrop.querySelector<HTMLButtonElement>("#folder-modal-save")!;

  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = "";
    const name = input.value.trim();

    try {
      folders.validateFolderName(name);
      submitBtn.disabled = true;
      await options.onSave(name);
      closeModal();
    } catch (err) {
      submitBtn.disabled = false;
      errorEl.hidden = false;
      errorEl.textContent = errorMessage(err);
      input.focus();
    }
  });
}

export function showShortcutsDialog(): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl";

  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop shortcuts-backdrop";
  backdrop.id = "shortcuts-backdrop";
  backdrop.innerHTML = `<section class="note-edit-dialog shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-dialog-title"><header class="note-edit-dialog-head"><div class="shortcuts-dialog-title-group"><span class="note-edit-icon-badge" aria-hidden="true">${svg(icons.keyboard, "note-edit-icon-svg")}</span><h2 id="shortcuts-dialog-title">${s.keyboardShortcutsTitle}</h2></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}" title="${s.closeEditor} (Esc)">${svg(icons.close, "dialog-close-svg")}</button></header><div class="shortcuts-dialog-body"><section class="shortcuts-group"><h3>${s.shortcutsNavTitle}</h3><dl class="shortcuts-grid"><div class="shortcut-entry"><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>${s.shortcutPrevNextDay}</dd></div><div class="shortcut-entry"><dt><kbd>T</kbd></dt><dd>${s.shortcutToday}</dd></div><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>↑</kbd> <span class="shortcut-or">/</span> <kbd>Home</kbd></dt><dd>${s.shortcutScrollTop}</dd></div></dl></section><section class="shortcuts-group"><h3>${s.shortcutsEditorTitle}</h3><dl class="shortcuts-grid"><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>Enter</kbd></dt><dd>${s.shortcutSaveNote}</dd></div><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>D</kbd></dt><dd>${s.shortcutZenMode}</dd></div><div class="shortcut-entry"><dt><kbd>*</kbd><kbd>Space</kbd></dt><dd>${s.shortcutBulletList}</dd></div><div class="shortcut-entry"><dt><kbd>-</kbd><kbd>[</kbd><kbd>]</kbd><kbd>Space</kbd></dt><dd>${s.shortcutChecklist}</dd></div></dl></section><section class="shortcuts-group"><h3>${s.shortcutsGeneralTitle}</h3><dl class="shortcuts-grid"><div class="shortcut-entry"><dt><kbd>${modKey}</kbd><kbd>K</kbd> <span class="shortcut-or">/</span> <kbd>/</kbd></dt><dd>${s.shortcutCommandPalette}</dd></div><div class="shortcut-entry"><dt><kbd>?</kbd></dt><dd>${s.shortcutHelp}</dd></div><div class="shortcut-entry"><dt><kbd>Esc</kbd></dt><dd>${s.shortcutEscape}</dd></div></dl></section></div></section>`;

  host.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("keydown", onKeydown);
      closeDialog(backdrop);
    }
  });
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("keydown", onKeydown);
      closeDialog(backdrop);
    }
  };
  window.addEventListener("keydown", onKeydown);
}

export async function showLinkPickerModal(textarea: HTMLTextAreaElement): Promise<void> {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.slice(start, end).trim();

  let currentQuery = selectedText;
  let activeIndex = 0;
  let allNotes: Note[] = [];

  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop link-picker-backdrop";
  backdrop.id = "link-picker-backdrop";
  backdrop.innerHTML = `
    <section class="link-picker-dialog" role="dialog" aria-modal="true" aria-label="${s.insertWikilink}">
      <header class="link-picker-header">
        <div class="link-picker-search-field">
          <span class="link-picker-search-icon" aria-hidden="true">${svg(icons.search, "picker-search-svg")}</span>
          <input type="text" class="link-picker-input" id="link-picker-search" placeholder="${s.searchPlaceholder}" autocomplete="off" spellcheck="false" value="${escapeHtml(selectedText)}" aria-label="${s.insertWikilink}">
          <button type="button" class="link-picker-esc-hint" data-close-dialog aria-label="${s.closeEditor}" title="${s.closeEditor} (Esc)">esc</button>
        </div>
      </header>
      <div class="link-picker-results" id="link-picker-results" role="listbox"></div>
      <footer class="link-picker-footer">
        <span class="link-picker-hint">${s.pickerNavHint}</span>
      </footer>
    </section>
  `;

  host.appendChild(backdrop);
  document.body.style.overflow = "hidden";

  const searchInput = backdrop.querySelector<HTMLInputElement>("#link-picker-search")!;
  const resultsContainer = backdrop.querySelector<HTMLElement>("#link-picker-results")!;

  const closePicker = () => {
    window.removeEventListener("keydown", onKeydown);
    closeDialog(backdrop);
    textarea.focus();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePicker();
    }
  };
  window.addEventListener("keydown", onKeydown);

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
    }
  });

  const pickerLabels = {
    todayBadge: s.badgeToday,
    yesterdayBadge: s.badgeYesterday,
    dateBadge: s.badgeDate,
    todayLabel: s.today,
    yesterdayLabel: s.yesterday,
    emptyNoteLabel: s.emptyNote
  };

  function renderList(): void {
    const { dates, notes: candidateNotes } = getLinkPickerCandidates(currentQuery, allNotes, 30, pickerLabels);
    const totalItems = [...dates, ...candidateNotes];

    if (totalItems.length === 0) {
      resultsContainer.innerHTML = `<div class="link-picker-empty"><p>${s.searchNoResults}</p></div>`;
      return;
    }

    if (activeIndex >= totalItems.length) activeIndex = 0;

    let html = "";
    let itemIdx = 0;

    if (dates.length > 0) {
      html += `<div class="link-picker-section-label">${escapeHtml(s.pickerSectionDates)}</div>`;
      for (const d of dates) {
        const isSelected = itemIdx === activeIndex;
        html += `
          <button type="button" class="link-picker-row ${isSelected ? "is-selected" : ""}" data-item-idx="${itemIdx}" data-target="${escapeHtml(d.target)}" role="option" aria-selected="${isSelected}">
            <span class="link-picker-row-badge is-date">${escapeHtml(d.badge)}</span>
            <span class="link-picker-row-text prose">${renderInlineMarkdown(d.line)}</span>
          </button>
        `;
        itemIdx++;
      }
    }

    if (candidateNotes.length > 0) {
      html += `<div class="link-picker-section-label">${escapeHtml(s.pickerSectionNotes)}</div>`;
      for (const n of candidateNotes) {
        const isSelected = itemIdx === activeIndex;
        html += `
          <button type="button" class="link-picker-row ${isSelected ? "is-selected" : ""}" data-item-idx="${itemIdx}" data-target="${escapeHtml(n.target)}" role="option" aria-selected="${isSelected}">
            <span class="link-picker-row-badge">${escapeHtml(n.badge)}</span>
            <span class="link-picker-row-text prose">${renderInlineMarkdown(n.line)}</span>
            ${n.tag ? `<span class="link-picker-row-tag">#${escapeHtml(n.tag)}</span>` : ""}
          </button>
        `;
        itemIdx++;
      }
    }

    resultsContainer.innerHTML = html;

    resultsContainer.querySelectorAll<HTMLButtonElement>(".link-picker-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target ?? "";
        applyLinkInsertion(target);
      });
    });

    const activeEl = resultsContainer.querySelector<HTMLElement>(".link-picker-row.is-selected");
    if (typeof activeEl?.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }

  function applyLinkInsertion(target: string): void {
    const syntax = `${buildWikilinkInsertion(target, selectedText)} `;
    textarea.setRangeText(syntax, start, end, "end");
    closePicker();
    resizeEditor(textarea);
    const form = textarea.closest("form");
    if (form) {
      updateEditorWordCount(form);
      form.classList.add("has-content");
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  searchInput.addEventListener("input", () => {
    currentQuery = searchInput.value;
    activeIndex = 0;
    renderList();
  });

  searchInput.addEventListener("keydown", (e) => {
    const { dates, notes: candidateNotes } = getLinkPickerCandidates(currentQuery, allNotes, 30, pickerLabels);
    const totalItems = [...dates, ...candidateNotes];
    if (totalItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % totalItems.length;
      renderList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + totalItems.length) % totalItems.length;
      renderList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = totalItems[activeIndex];
      if (selected) applyLinkInsertion(selected.target);
    }
  });

  allNotes = await notes.listAll();
  setWikilinkNotesIndex(allNotes);
  renderList();
  requestAnimationFrame(() => {
    searchInput.focus();
    searchInput.select();
  });
}

export function showEditDialog(note: Note, foldersList: Folder[] = []): void {
  const s = currentStrings();
  const host = requireElement<HTMLElement>("#dialog-host");
  const formattedDate = formatDateHeading(note.noteDate);
  void notes.listAll().then((all) => setWikilinkNotesIndex(all));

  const backdrop = document.createElement("div");
  backdrop.className = "note-edit-backdrop";
  backdrop.id = "edit-note-backdrop";
  backdrop.innerHTML = `<section class="note-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="note-edit-title"><header class="note-edit-dialog-head"><div class="note-edit-dialog-title-group"><span class="note-edit-icon-badge" aria-hidden="true">${svg(icons.edit, "note-edit-icon-svg")}</span><h2 id="note-edit-title">${s.editNoteTitle}</h2><a href="${appUrl(`/?date=${note.noteDate}`)}" data-link class="note-edit-date-badge" title="${s.openCalendar}">${svg(icons.calendar, "badge-calendar-svg")}<span>${formattedDate}</span></a></div><button type="button" class="note-edit-close" data-close-dialog aria-label="${s.closeEditor}" title="${s.closeEditor} (Esc)">${svg(icons.close, "dialog-close-svg")}</button></header><div class="note-modal-form">${editorMarkup("edit-note-form", note.content, s.saveChanges, true, note.folderId, foldersList)}</div></section>`;
  host.replaceChildren(backdrop);
  document.body.style.overflow = "hidden";

  if (!foldersList.length) {
    void folders.listAll().then((allF) => {
      const sel = backdrop.querySelector<HTMLSelectElement>("select[name='folderId']");
      if (sel && sel.options.length <= 1) {
        sel.innerHTML = `<option value="" ${!note.folderId ? "selected" : ""}>${s.folderUnfiled}</option>${allF.map((f) => `<option value="${f.id}" ${f.id === note.folderId ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}`;
      }
    });
  }

  const cleanup = () => {
    window.removeEventListener("keydown", onKeydown);
  };

  backdrop.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === backdrop || target.closest("[data-close-dialog]")) {
      cleanup();
      closeDialog(backdrop);
    }
  });
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      const currentHost = document.querySelector<HTMLElement>("#dialog-host");
      if (currentHost && currentHost.lastElementChild !== backdrop) return;
      cleanup();
      closeDialog(backdrop);
    }
  };
  window.addEventListener("keydown", onKeydown);
  const form = requireElement<HTMLFormElement>("#edit-note-form");
  const textarea = requireElement<HTMLTextAreaElement>("#edit-note-form textarea");
  bindFormatting(form, textarea);
  bindEditorPreview(form);
  updateEditorWordCount(form);
  textarea.addEventListener("input", () => updateEditorWordCount(form));
  textarea.focus();
  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  attachTagAutocomplete(textarea, async () => tagCounts(await notes.listAll()));
  textarea.addEventListener("input", () => {
    const cursor = textarea.selectionStart;
    if (cursor >= 2 && textarea.value.slice(cursor - 2, cursor) === "[[") {
      textarea.setRangeText("", cursor - 2, cursor, "end");
      void showLinkPickerModal(textarea);
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!textarea.value.trim()) {
      showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => {
        await notes.delete(note.id);
        void track("note_deleted");
        cleanup();
        closeDialog(backdrop);
        await triggerCalendarRefresh();
        await renderRoute();
      });
      return;
    }
    setBusy(form, true);
    try {
      const folderInput = form.querySelector<HTMLInputElement | HTMLSelectElement>("input[name='folderId'], select[name='folderId']");
      const folderId = folderInput ? (folderInput.value || null) : undefined;
      await notes.update(note.id, textarea.value, folderId);
      cleanup();
      closeDialog(backdrop);
      await renderRoute();
    } catch (error) {
      status(form, errorMessage(error), true);
      setBusy(form, false);
    }
  });
}
