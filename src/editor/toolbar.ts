import { icons, svg } from "../icons";
import { currentStrings, getLocale } from "../i18n";
import { escapeHtml, renderMarkdown } from "../markdown";
import type { Folder } from "../models";
import { normalizeAppLinks } from "../routing";
import { getPredefinedTemplates } from "../templates";

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function updateEditorWordCount(form: HTMLFormElement): void {
  const textarea = form.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
  const countEl = form.querySelector<HTMLElement>(".editor-word-count");
  if (!textarea || !countEl) return;
  const count = countWords(textarea.value);
  const s = currentStrings();
  countEl.textContent = count > 0 ? s.wordCount(count) : "";
}

export function resizeEditor(textarea: HTMLTextAreaElement): void {
  if (document.body.classList.contains("is-zen-mode")) {
    textarea.style.height = "";
    return;
  }
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function setEditorMode(form: HTMLFormElement, mode: "write" | "preview", shouldFocus = true): void {
  const writeBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
  const previewBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');
  const textarea = form.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
  const previewPane = form.querySelector<HTMLElement>(".editor-preview");
  const toolsCluster = form.querySelector<HTMLElement>(".editor-tools-cluster");
  const templatePicker = form.querySelector<HTMLElement>(".editor-template-picker");
  const hintEl = form.querySelector<HTMLElement>(".simple-editor-hint");

  if (!writeBtn || !previewBtn || !textarea || !previewPane) return;

  if (mode === "write") {
    writeBtn.classList.add("is-active");
    writeBtn.setAttribute("aria-selected", "true");
    previewBtn.classList.remove("is-active");
    previewBtn.setAttribute("aria-selected", "false");
    textarea.classList.remove("is-hidden");
    previewPane.classList.add("is-hidden");
    toolsCluster?.classList.remove("is-hidden");
    if (templatePicker) templatePicker.classList.remove("is-hidden");
    if (hintEl) hintEl.classList.remove("is-hidden");
    form.classList.remove("is-preview");
    const hasText = Boolean(textarea.value.trim());
    form.classList.toggle("has-content", hasText || textarea.value.includes("\n") || form.contains(document.activeElement));
    if (shouldFocus) {
      textarea.focus();
    }
  } else {
    previewBtn.classList.add("is-active");
    previewBtn.setAttribute("aria-selected", "true");
    writeBtn.classList.remove("is-active");
    writeBtn.setAttribute("aria-selected", "false");
    textarea.classList.add("is-hidden");
    previewPane.classList.remove("is-hidden");
    toolsCluster?.classList.add("is-hidden");
    if (templatePicker) {
      templatePicker.removeAttribute("open");
      templatePicker.classList.add("is-hidden");
    }
    if (hintEl) hintEl.classList.add("is-hidden");
    form.classList.add("is-preview");
    form.classList.add("has-content");

    const content = textarea.value.trim();
    if (content) {
      previewPane.innerHTML = renderMarkdown(content, true);
      normalizeAppLinks(previewPane);
    } else {
      const s = currentStrings();
      previewPane.innerHTML = `<p class="editor-preview-empty">${s.editorEmptyPreview}</p>`;
    }
  }
}

export function bindEditorPreview(form: HTMLFormElement): void {
  const writeBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="write"]');
  const previewBtn = form.querySelector<HTMLButtonElement>('[data-editor-mode="preview"]');

  writeBtn?.addEventListener("click", () => setEditorMode(form, "write", true));
  previewBtn?.addEventListener("click", () => setEditorMode(form, "preview", false));
}

export function toggleZenMode(targetForm?: HTMLFormElement): void {
  const isZen = document.body.classList.toggle("is-zen-mode");
  const s = currentStrings();
  document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-zen"]').forEach((btn) => {
    btn.classList.toggle("is-active", isZen);
    btn.innerHTML = `${svg(isZen ? icons.minimize : icons.maximize, "editor-mode-svg")}`;
    const label = isZen ? s.exitZenMode : s.zenMode;
    btn.setAttribute("title", `${label} (⌘D)`);
    btn.setAttribute("aria-label", label);
  });
  const formToFocus = targetForm ?? document.querySelector<HTMLFormElement>("#edit-note-form, #new-note-form");
  if (formToFocus) {
    const textarea = formToFocus.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
    if (isZen) {
      if (textarea) textarea.style.height = "";
      textarea?.focus();
    }
  }
  if (!isZen) {
    document.querySelectorAll<HTMLTextAreaElement>("textarea.simple-editor-textarea").forEach((ta) => {
      ta.style.height = "auto";
      resizeEditor(ta);
    });
    const composer = document.querySelector<HTMLFormElement>("#new-note-form");
    if (composer) {
      const compTa = composer.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
      const hasText = Boolean(compTa?.value.trim());
      const isFocused = composer.contains(document.activeElement) || Boolean(composer.querySelector(".editor-template-picker[open]"));
      const isPreview = composer.classList.contains("is-preview");
      composer.classList.toggle("has-content", hasText || Boolean(compTa?.value.includes("\n")) || isFocused || isPreview);
      const submitBtn = composer.querySelector<HTMLButtonElement>("button[type='submit']");
      if (submitBtn) submitBtn.disabled = !hasText;
      if (!hasText && !compTa?.value.includes("\n") && !isFocused && !isPreview) {
        if (compTa) compTa.style.height = "";
      }
    }
  }
}

export function editorMarkup(
  id: string,
  value: string,
  label: string,
  isModal = false,
  selectedFolderId?: string | null,
  allFolders: Folder[] = [],
  isEmptyDay = false
): string {
  const s = currentStrings();
  const isSubmitDisabled = !isModal && !value.trim();
  const currentFolderName = selectedFolderId ? (allFolders.find((f) => f.id === selectedFolderId)?.name ?? s.folderUnfiled) : s.folderUnfiled;
  const folderSelector = `<details class="editor-folder-picker"><summary class="editor-folder-badge-btn" title="${s.selectFolder}">${svg(icons.folder, "editor-folder-badge-svg")}<span class="editor-folder-badge-name">${escapeHtml(currentFolderName)}</span>${svg(icons.chevronDown, "editor-folder-badge-arrow")}</summary><div class="composer-folder-popover" role="menu"><div class="folder-popover-header">${s.selectFolder}</div><button type="button" role="menuitem" class="composer-folder-item ${!selectedFolderId ? "is-active" : ""}" data-set-folder="">${svg(icons.folder, "folder-option-svg")}<span>${s.folderUnfiled}</span>${!selectedFolderId ? svg(icons.check, "folder-check-svg") : ""}</button>${allFolders.map((f) => `<button type="button" role="menuitem" class="composer-folder-item ${selectedFolderId === f.id ? "is-active" : ""}" data-set-folder="${f.id}">${svg(icons.folder, "folder-option-svg")}<span>${escapeHtml(f.name)}</span>${selectedFolderId === f.id ? svg(icons.check, "folder-check-svg") : ""}</button>`).join("")}<div class="folder-picker-sep" role="separator"></div><button type="button" role="menuitem" class="composer-folder-item" data-action="create-folder">${svg(icons.folderPlus, "folder-option-svg")}<span>${s.createFolder}…</span></button></div></details><input type="hidden" name="folderId" value="${selectedFolderId ?? ""}">`;
  const textareaRows = isModal ? 6 : (isEmptyDay ? 8 : 1);
  const placeholder = isEmptyDay ? s.emptyDayComposerPlaceholder : s.composerPlaceholder;
  const cardClasses = ["editor-card", isModal ? "editor-card-modal" : "", isEmptyDay ? "empty-day-editor-card" : ""].filter(Boolean).join(" ");
  return `<form class="${cardClasses}" id="${id}" novalidate><div class="simple-editor-toolbar" aria-label="${s.markdownFormatting}"><div class="editor-tools-cluster"><button type="button" data-format="heading" aria-label="Heading" title="Add heading"><strong>H</strong></button><button type="button" data-format="bold" aria-label="${s.toolBold}" title="${s.toolBold}"><strong>B</strong></button><button type="button" data-format="italic" aria-label="${s.toolItalic}" title="${s.toolItalic}"><em>I</em></button><button type="button" data-format="quote" class="editor-tool-quote" aria-label="${s.toolQuote}" title="${s.toolQuote}">${svg(icons.quote, "editor-tool-svg")}</button><button type="button" data-format="code" aria-label="${s.toolCode}" title="${s.toolCode}">&lt;&gt;</button><button type="button" data-format="wikilink" class="editor-tool-wikilink" aria-label="${s.insertWikilink}" title="${s.insertWikilink} ([[)">${svg(icons.link, "editor-tool-svg")}</button><span class="editor-tool-sep" aria-hidden="true"></span><button type="button" data-format="numbered" aria-label="Numbered list" title="Add a numbered list"><span class="tool-num-icon">1. ≡</span></button><button type="button" data-format="list" aria-label="${s.toolBulletList}" title="${s.toolBulletList}">• ≡</button><button type="button" data-format="task" aria-label="${s.toolChecklist}" title="${s.toolChecklist}">✓ ≡</button></div><div class="editor-toolbar-actions"><details class="editor-template-picker"><summary class="editor-mode-btn editor-template-btn" title="${s.toolTemplates}" aria-label="${s.toolTemplates}">${svg(icons.template, "editor-mode-svg")}</summary><div class="editor-template-menu" role="menu">${getPredefinedTemplates(getLocale()).map((tmpl) => `<button type="button" class="editor-template-item" data-insert-template="${tmpl.id}"><strong>${escapeHtml(tmpl.name)}</strong><span>${escapeHtml(tmpl.description)}</span></button>`).join("")}</div></details><div class="editor-mode-toggle" role="tablist" aria-label="${s.editorViewMode}"><button type="button" class="editor-mode-btn is-active" data-editor-mode="write" role="tab" aria-selected="true" title="${s.editorWrite}" aria-label="${s.editorWrite}">${svg(icons.edit, "editor-mode-svg")}</button><button type="button" class="editor-mode-btn" data-editor-mode="preview" role="tab" aria-selected="false" title="${s.editorPreview}" aria-label="${s.editorPreview}">${svg(icons.eye, "editor-mode-svg")}</button><span class="editor-tool-sep" aria-hidden="true"></span><button type="button" class="editor-mode-btn editor-zen-btn" data-action="toggle-zen" title="${s.zenMode} (⌘D)" aria-label="${s.zenMode}">${svg(icons.maximize, "editor-mode-svg")}</button></div></div></div><textarea id="${id}-body" name="bodyMarkdown" rows="${textareaRows}" aria-label="${s.notesTitle}" placeholder="${placeholder}" class="editor-textarea simple-editor-textarea">${escapeHtml(value)}</textarea><div class="editor-preview prose is-hidden" id="${id}-preview" aria-live="polite"></div><div class="simple-editor-footer"><div class="editor-footer-left editor-footer-meta"><span class="editor-word-count" aria-live="polite"></span>${folderSelector}<span class="simple-editor-hint editor-save-hint" data-save-status aria-live="polite">${isModal ? '<span class="shortcut-kbd-hint"><kbd>⌘Enter</kbd></span>' : (value ? s.draftRestored : s.markdownSupported)}</span></div><div class="editor-modal-actions">${isModal ? `<button type="button" class="btn-secondary" data-close-dialog>${s.cancel}</button>` : ""}<button type="submit" class="save-btn-rect"${isSubmitDisabled ? " disabled" : ""}>${isModal ? `${svg(icons.check, "save-icon-svg")}<span>${label}</span>` : label}</button></div></div></form>`;
}
