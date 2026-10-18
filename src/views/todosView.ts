import { track } from "../analytics/analytics";
import { icons, svg } from "../icons";
import { currentStrings, formatDateHeading, formatShortDate, getLocale } from "../i18n";
import { escapeHtml, extractTags, renderInlineMarkdown, renderMarkdown, toggleTaskInMarkdown } from "../markdown";
import type { Note } from "../models";
import { appUrl, normalizeAppLinks } from "../routing";
import { notes } from "../servicesContext";
import { attachTagAutocomplete } from "../tag-autocomplete";
import { getPredefinedTemplates } from "../templates";
import { formatTime, isoDate, tagCounts } from "../utils/date";
import { errorMessage, setBusy, status } from "../utils/dom";
import { findNoteBacklinks } from "../wikilinks";
import { bindFormatting } from "../editor/formatting";
import { bindEditorPreview, updateEditorWordCount } from "../editor/toolbar";
import { showConfirm, showLinkPickerModal } from "../editor/modals";
import { refreshCalendar } from "./todayView";
import { renderRoute } from "../router";

export function formatTaskAge(noteDate: string, todayIso = isoDate(new Date())): { label: string; ageClass: "fresh" | "aging" | "stale" } {
  const s = currentStrings();
  const noteTime = new Date(`${noteDate}T12:00:00`).getTime();
  const todayTime = new Date(`${todayIso}T12:00:00`).getTime();
  const days = Math.max(0, Math.round((todayTime - noteTime) / (1000 * 60 * 60 * 24)));

  if (days === 0) {
    return { label: s.taskAgeToday, ageClass: "fresh" };
  }
  if (days < 3) {
    return { label: s.taskAgeDays(days), ageClass: "fresh" };
  }
  if (days < 7) {
    return { label: s.taskAgeDays(days), ageClass: "aging" };
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return { label: s.taskAgeWeeks(weeks), ageClass: "stale" };
  }
  const months = Math.floor(days / 30);
  return { label: s.taskAgeMonths(months), ageClass: "stale" };
}

export type TodoGrouping = "date" | "tag" | "all";

export interface TaskItem {
  note: Note;
  line: string;
  lineIndex: number;
}

export interface TodoGroup {
  id: string;
  title: string;
  count: number;
  tasks: TaskItem[];
}

export function groupTasks(
  tasks: TaskItem[],
  grouping: TodoGrouping,
  todayIso = isoDate(new Date())
): TodoGroup[] {
  const s = currentStrings();
  if (grouping === "all") {
    return [{ id: "all", title: "", count: tasks.length, tasks }];
  }

  if (grouping === "date") {
    const todayTasks: TaskItem[] = [];
    const yesterdayTasks: TaskItem[] = [];
    const thisWeekTasks: TaskItem[] = [];
    const earlierTasks: TaskItem[] = [];

    const todayTime = new Date(`${todayIso}T12:00:00`).getTime();
    const sorted = [...tasks].sort((a, b) => b.note.noteDate.localeCompare(a.note.noteDate));

    for (const item of sorted) {
      const noteTime = new Date(`${item.note.noteDate}T12:00:00`).getTime();
      const days = Math.round((todayTime - noteTime) / (1000 * 60 * 60 * 24));
      if (days <= 0) {
        todayTasks.push(item);
      } else if (days === 1) {
        yesterdayTasks.push(item);
      } else if (days <= 7) {
        thisWeekTasks.push(item);
      } else {
        earlierTasks.push(item);
      }
    }

    const groups: TodoGroup[] = [];
    if (todayTasks.length > 0) {
      groups.push({ id: "today", title: s.todoGroupToday, count: todayTasks.length, tasks: todayTasks });
    }
    if (yesterdayTasks.length > 0) {
      groups.push({ id: "yesterday", title: s.todoGroupYesterday, count: yesterdayTasks.length, tasks: yesterdayTasks });
    }
    if (thisWeekTasks.length > 0) {
      groups.push({ id: "this-week", title: s.todoGroupThisWeek, count: thisWeekTasks.length, tasks: thisWeekTasks });
    }
    if (earlierTasks.length > 0) {
      groups.push({ id: "earlier", title: s.todoGroupEarlier, count: earlierTasks.length, tasks: earlierTasks });
    }
    return groups;
  }

  if (grouping === "tag") {
    const tagBuckets = new Map<string, TaskItem[]>();
    const untaggedTasks: TaskItem[] = [];

    for (const item of tasks) {
      const lineTags = extractTags(item.line);
      const tags = lineTags.length > 0 ? lineTags : item.note.tags;
      const primaryTag = tags?.[0];

      if (primaryTag) {
        const bucket = tagBuckets.get(primaryTag) ?? [];
        bucket.push(item);
        tagBuckets.set(primaryTag, bucket);
      } else {
        untaggedTasks.push(item);
      }
    }

    const sortedTags = [...tagBuckets.keys()].sort((a, b) => a.localeCompare(b));
    const groups: TodoGroup[] = [];

    for (const tag of sortedTags) {
      const tagTasks = tagBuckets.get(tag) ?? [];
      if (tagTasks.length > 0) {
        groups.push({
          id: `tag-${tag}`,
          title: `#${tag}`,
          count: tagTasks.length,
          tasks: tagTasks
        });
      }
    }

    if (untaggedTasks.length > 0) {
      groups.push({
        id: "untagged",
        title: s.todoGroupUntagged,
        count: untaggedTasks.length,
        tasks: untaggedTasks
      });
    }

    return groups;
  }

  return [{ id: "all", title: "", count: tasks.length, tasks }];
}

let activeTodoNoteId: string | null = null;
let activeTodoSidePanelMode: "view" | "edit" = "view";
let activeTodoHighlightedLine: number | null = null;
let activeTodoTaskText: string | null = null;

export function getActiveTodoSidePanelMode(): "view" | "edit" {
  return activeTodoSidePanelMode;
}

export function setActiveTodoSidePanelMode(mode: "view" | "edit"): void {
  activeTodoSidePanelMode = mode;
}

export function closeTodoSidePanel(contentRoot?: HTMLElement): void {
  activeTodoNoteId = null;
  activeTodoSidePanelMode = "view";
  activeTodoHighlightedLine = null;
  activeTodoTaskText = null;
  const root = contentRoot ?? document;
  const layout = root.querySelector<HTMLElement>("#todo-view-layout");
  const panel = root.querySelector<HTMLElement>("#todo-side-panel");
  const content = root.querySelector<HTMLElement>("#page-content") ?? (contentRoot?.classList.contains("lite-shell-main") ? contentRoot : null);
  if (layout) layout.classList.remove("has-panel-open");
  if (content) content.classList.remove("has-todo-split");
  if (panel) {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  }
  root.querySelectorAll<HTMLElement>(".todo-item.is-selected").forEach((el) => el.classList.remove("is-selected"));
  root.querySelectorAll<HTMLElement>(".todo-note-jump.is-active").forEach((el) => el.classList.remove("is-active"));
}

export function renderTodoSidePanelView(note: Note, allNotes: Note[] = [], taskText: string | null = null): string {
  const s = currentStrings();
  const formattedDate = formatDateHeading(note.noteDate);
  const backlinks = allNotes.length ? findNoteBacklinks(note, allNotes) : [];
  return `<header class="todo-side-panel-header"><div class="todo-panel-header-top"><div class="todo-panel-kicker-badge"><span class="todo-panel-kicker-dot" aria-hidden="true"></span><span class="todo-panel-kicker">${escapeHtml(s.linkedNotePanel)}</span></div><div class="todo-panel-actions"><button type="button" class="todo-panel-btn todo-panel-edit-btn" data-panel-action="edit" title="${s.editInline}" aria-label="${s.editInline}">${svg(icons.edit, "panel-btn-svg")}<span>${s.editAction}</span></button><a href="${appUrl(`/?date=${note.noteDate}#note-${note.id}`)}" data-link class="todo-panel-btn todo-panel-jump-btn" title="${s.goToNote}" aria-label="${s.goToNote}">${svg(icons.externalLink, "panel-btn-svg")}</a><button type="button" class="todo-panel-btn todo-panel-close-btn" data-panel-action="close" title="${s.closeSidePanel} (Esc)" aria-label="${s.closeSidePanel}">${svg(icons.close, "panel-btn-svg")}</button></div></div><div class="todo-panel-header-focus">${taskText ? `<h2 class="todo-panel-focus-task"><span class="focus-task-quote">“</span><span class="todo-panel-origin-task" title="${escapeHtml(taskText)}">${escapeHtml(taskText)}</span><span class="focus-task-quote">”</span></h2>` : ""}<div class="todo-panel-header-meta"><a href="${appUrl(`/?date=${note.noteDate}#note-${note.id}`)}" data-link class="todo-panel-date-badge" title="${s.openCalendar}">${svg(icons.calendar, "badge-calendar-svg")}<span>${formattedDate}</span></a><span class="meta-dot" aria-hidden="true">·</span><time datetime="${note.createdAt}" class="todo-panel-header-time">${formatTime(note.createdAt, note.noteDate)}</time></div></div></header><div class="todo-side-panel-body"><article class="todo-side-panel-note"><div class="prose todo-panel-prose">${renderMarkdown(note.content, true)}</div>${backlinks.length ? `<div class="note-backlinks todo-panel-backlinks"><div class="note-backlinks-header">${svg(icons.link, "backlink-icon-svg")}<span>${backlinks.length} ${backlinks.length === 1 ? s.backlinkSingle : s.backlinkPlural}</span></div><ul class="note-backlinks-list">${backlinks.map((bl) => `<li class="note-backlink-item"><a href="${appUrl(`/?date=${bl.sourceNote.noteDate}#note-${bl.sourceNote.id}`)}" data-link class="backlink-date-badge" title="${s.openCalendar}">${formatShortDate(bl.sourceNote.noteDate)}</a><span class="backlink-snippet-rendered prose">${renderInlineMarkdown(bl.snippet)}</span></li>`).join("")}</ul></div>` : ""}${note.tags.length ? `<div class="note-tags todo-panel-tags">${note.tags.map((tag) => `<a href="${appUrl(`/?date=${note.noteDate}&tag=${encodeURIComponent(tag)}`)}" data-link class="tag-pill">#${escapeHtml(tag)}</a>`).join("")}</div>` : ""}</article></div>`;
}

export function renderTodoSidePanelEdit(note: Note): string {
  const s = currentStrings();
  const formattedDate = formatDateHeading(note.noteDate);
  return `<header class="todo-side-panel-header"><div class="todo-panel-title-group"><span class="todo-panel-icon-badge is-editing" aria-hidden="true">${svg(icons.edit, "panel-icon-svg")}</span><div class="todo-panel-title-meta"><span class="todo-panel-mode-title">${s.editNoteTitle}</span><span class="todo-panel-date-sub">${formattedDate}</span></div></div><div class="todo-panel-actions"><button type="button" class="todo-panel-btn todo-panel-close-btn" data-panel-action="cancel-edit" title="${s.cancel} (Esc)" aria-label="${s.cancel}">${svg(icons.close, "panel-btn-svg")}</button></div></header><div class="todo-side-panel-body is-editing"><form class="editor-card todo-panel-inline-editor" id="todo-panel-edit-form" novalidate><div class="simple-editor-toolbar" aria-label="${s.markdownFormatting}"><div class="editor-tools-cluster"><button type="button" data-format="heading" aria-label="Heading" title="Add heading"><strong>H</strong></button><button type="button" data-format="bold" aria-label="${s.toolBold}" title="${s.toolBold}"><strong>B</strong></button><button type="button" data-format="italic" aria-label="${s.toolItalic}" title="${s.toolItalic}"><em>I</em></button><button type="button" data-format="quote" class="editor-tool-quote" aria-label="${s.toolQuote}" title="${s.toolQuote}">${svg(icons.quote, "editor-tool-svg")}</button><button type="button" data-format="code" aria-label="${s.toolCode}" title="${s.toolCode}">&lt;&gt;</button><button type="button" data-format="wikilink" class="editor-tool-wikilink" aria-label="${s.insertWikilink}" title="${s.insertWikilink} ([[)">${svg(icons.link, "editor-tool-svg")}</button><span class="editor-tool-sep" aria-hidden="true"></span><button type="button" data-format="numbered" aria-label="Numbered list" title="Add a numbered list"><span class="tool-num-icon">1. ≡</span></button><button type="button" data-format="list" aria-label="${s.toolBulletList}" title="${s.toolBulletList}">• ≡</button><button type="button" data-format="task" aria-label="${s.toolChecklist}" title="${s.toolChecklist}">✓ ≡</button></div><div class="editor-toolbar-actions"><details class="editor-template-picker"><summary class="editor-mode-btn editor-template-btn" title="${s.toolTemplates}" aria-label="${s.toolTemplates}">${svg(icons.template, "editor-mode-svg")}</summary><div class="editor-template-menu" role="menu">${getPredefinedTemplates(getLocale()).map((tmpl) => `<button type="button" class="editor-template-item" data-insert-template="${tmpl.id}"><strong>${escapeHtml(tmpl.name)}</strong><span>${escapeHtml(tmpl.description)}</span></button>`).join("")}</div></details><div class="editor-mode-toggle" role="tablist" aria-label="${s.editorViewMode}"><button type="button" class="editor-mode-btn is-active" data-editor-mode="write" role="tab" aria-selected="true" title="${s.editorWrite}" aria-label="${s.editorWrite}">${svg(icons.edit, "editor-mode-svg")}</button><button type="button" class="editor-mode-btn" data-editor-mode="preview" role="tab" aria-selected="false" title="${s.editorPreview}" aria-label="${s.editorPreview}">${svg(icons.eye, "editor-mode-svg")}</button></div></div></div><textarea id="todo-panel-edit-body" name="bodyMarkdown" rows="10" aria-label="${s.notesTitle}" placeholder="${s.composerPlaceholder}" class="editor-textarea simple-editor-textarea">${escapeHtml(note.content)}</textarea><div class="editor-preview prose is-hidden" id="todo-panel-edit-preview" aria-live="polite"></div><div class="simple-editor-footer"><div class="editor-footer-left editor-footer-meta"><span class="editor-word-count" aria-live="polite"></span><span class="simple-editor-hint editor-save-hint" data-save-status aria-live="polite"><span class="shortcut-kbd-hint"><kbd>⌘Enter</kbd></span></span></div><div class="editor-modal-actions"><button type="button" class="btn-secondary" data-panel-action="cancel-edit">${s.cancel}</button><button type="submit" class="save-btn-rect">${svg(icons.check, "save-icon-svg")}<span>${s.saveChanges}</span></button></div></div></form></div>`;
}

export function bindSidePanelViewMode(content: HTMLElement, note: Note, allNotes: Note[]): void {
  const panel = content.querySelector<HTMLElement>("#todo-side-panel");
  if (!panel) return;

  normalizeAppLinks(panel);

  if (activeTodoHighlightedLine !== null) {
    const noteLines = note.content.split(/\r?\n/);
    let taskIdx = 0;
    for (let i = 0; i < noteLines.length; i++) {
      if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(noteLines[i])) {
        if (i === activeTodoHighlightedLine) {
          const matchingCb = panel.querySelector(`.interactive-task-checkbox[data-task-index="${taskIdx}"]`);
          const li = matchingCb?.closest("li");
          if (li) {
            li.classList.add("is-highlighted-todo");
            if (typeof li.scrollIntoView === "function") {
              li.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
          }
          break;
        }
        taskIdx++;
      }
    }
  }

  panel.querySelector<HTMLButtonElement>('[data-panel-action="edit"]')?.addEventListener("click", () => {
    activeTodoSidePanelMode = "edit";
    updateTodoSidePanel(content, allNotes);
  });

  panel.querySelector<HTMLButtonElement>('[data-panel-action="close"]')?.addEventListener("click", () => {
    closeTodoSidePanel(content);
  });

  panel.querySelectorAll<HTMLInputElement>(".interactive-task-checkbox").forEach((cb) => {
    cb.addEventListener("change", async (event) => {
      event.stopPropagation();
      const taskIndex = Number(cb.dataset.taskIndex);
      if (Number.isNaN(taskIndex)) return;
      const updatedContent = toggleTaskInMarkdown(note.content, taskIndex);
      await notes.update(note.id, updatedContent);
      void renderTodos(content);
    });
  });
}

export function bindSidePanelEditMode(content: HTMLElement, note: Note, allNotes: Note[]): void {
  const panel = content.querySelector<HTMLElement>("#todo-side-panel");
  if (!panel) return;

  const form = panel.querySelector<HTMLFormElement>("#todo-panel-edit-form");
  const textarea = panel.querySelector<HTMLTextAreaElement>("#todo-panel-edit-body");
  if (!form || !textarea) return;

  bindFormatting(form, textarea);
  bindEditorPreview(form);
  updateEditorWordCount(form);
  textarea.addEventListener("input", () => updateEditorWordCount(form));
  attachTagAutocomplete(textarea, async () => tagCounts(await notes.listAll()));

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-panel-action="cancel-edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTodoSidePanelMode = "view";
      updateTodoSidePanel(content, allNotes);
    });
  });

  textarea.addEventListener("input", () => {
    const cursor = textarea.selectionStart;
    if (cursor >= 2 && textarea.value.slice(cursor - 2, cursor) === "[[") {
      textarea.setRangeText("", cursor - 2, cursor, "end");
      void showLinkPickerModal(textarea);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const s = currentStrings();
    if (!textarea.value.trim()) {
      showConfirm(s.deleteConfirmTitle, s.deleteConfirmMessage, s.deleteNote, async () => {
        await notes.delete(note.id);
        void track("note_deleted");
        closeTodoSidePanel(content);
        await refreshCalendar();
        await renderTodos(content);
      });
      return;
    }

    setBusy(form, true);
    try {
      await notes.update(note.id, textarea.value);
      await refreshCalendar();
      activeTodoSidePanelMode = "view";
      await renderTodos(content);
    } catch (error) {
      status(form, errorMessage(error), true);
      setBusy(form, false);
    }
  });
}

export function updateTodoSidePanel(content: HTMLElement, allNotes: Note[]): void {
  const panel = content.querySelector<HTMLElement>("#todo-side-panel");
  const layout = content.querySelector<HTMLElement>("#todo-view-layout");
  if (!panel || !layout) return;

  const currentNote = activeTodoNoteId ? allNotes.find((n) => n.id === activeTodoNoteId && !n.archived) : null;
  if (!currentNote) {
    closeTodoSidePanel(content);
    return;
  }

  content.querySelectorAll<HTMLElement>(".todo-item").forEach((el) => {
    const isThis = el.dataset.todoNoteId === currentNote.id;
    el.classList.toggle("is-selected", isThis);
    el.querySelector(".todo-note-jump")?.classList.toggle("is-active", isThis);
  });

  content.classList.add("has-todo-split");
  layout.classList.add("has-panel-open");
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");

  if (activeTodoSidePanelMode === "edit") {
    panel.innerHTML = renderTodoSidePanelEdit(currentNote);
    bindSidePanelEditMode(content, currentNote, allNotes);
  } else {
    panel.innerHTML = renderTodoSidePanelView(currentNote, allNotes, activeTodoTaskText);
    bindSidePanelViewMode(content, currentNote, allNotes);
  }
}

export function todoItemMarkup(item: TaskItem, isSelected = false): string {
  const s = currentStrings();
  const { note, line, lineIndex } = item;
  const age = formatTaskAge(note.noteDate);
  const taskText = line.replace(/^\s*[-*+]\s+\[ \]\s+/, "");
  const noteHeading = note.title?.trim()
    ? `${s.goToNote}: ${note.title.trim()} · ${formatShortDate(note.noteDate)}`
    : `${s.goToNote} · ${formatShortDate(note.noteDate)}`;
  return `<li class="todo-item ${isSelected ? "is-selected" : ""}" data-todo-note-id="${note.id}"><label class="lite-task-check"><input type="checkbox" data-task-note="${note.id}" data-task-line="${lineIndex}"><span>${escapeHtml(
    taskText
  )}</span></label><div class="todo-item-meta"><span class="todo-age-chip age-${age.ageClass}">${age.label}</span><a href="${appUrl(
    `/?date=${note.noteDate}#note-${note.id}`
  )}" data-link data-open-note="${note.id}" data-task-line="${lineIndex}" data-task-text="${escapeHtml(taskText)}" class="todo-note-link todo-note-jump ${isSelected ? "is-active" : ""}" data-tooltip="${escapeHtml(noteHeading)}" aria-label="${escapeHtml(noteHeading)}"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="todo-jump-svg" aria-hidden="true"><path d="M4 12L12 4M12 4H6M12 4V10"/></svg></a></div></li>`;
}

export async function renderTodos(content: HTMLElement): Promise<void> {
  const s = currentStrings();
  const allNotes = await notes.listAll();
  const tasks: TaskItem[] = allNotes
    .filter((note) => !note.archived)
    .flatMap((note) =>
      note.content
        .split(/\r?\n/)
        .map((line, lineIndex) => ({ note, line, lineIndex }))
        .filter(({ line }) => /^\s*[-*+]\s+\[ \]\s+/.test(line))
    );

  document.title = `${s.todosTitle} · Rook Lite`;

  if (!tasks.length) {
    activeTodoNoteId = null;
    activeTodoSidePanelMode = "view";
    activeTodoHighlightedLine = null;
    activeTodoTaskText = null;
    content.classList.remove("has-todo-split");
    content.innerHTML = `<div class="page-head"><div><h1>${s.todosTitle}</h1><p class="lede">${s.todosLede}</p></div></div><div class="empty-notes lite-page-placeholder"><p>${s.noOpenTasks}</p><span>${s.noOpenTasksPrompt}</span></div>`;
    return;
  }

  const params = new URLSearchParams(location.search);
  const paramGroup = params.get("group");
  let storedGroup: string | null = null;
  try {
    storedGroup = localStorage.getItem("rook_todos_grouping");
  } catch {
    // ignore
  }

  const validGroupings: TodoGrouping[] = ["date", "tag", "all"];
  const grouping: TodoGrouping = validGroupings.includes(paramGroup as TodoGrouping)
    ? (paramGroup as TodoGrouping)
    : validGroupings.includes(storedGroup as TodoGrouping)
    ? (storedGroup as TodoGrouping)
    : "date";

  const groups = groupTasks(tasks, grouping);

  const activeNote = activeTodoNoteId ? allNotes.find((n) => n.id === activeTodoNoteId && !n.archived) : null;
  if (!activeNote) {
    activeTodoNoteId = null;
    activeTodoSidePanelMode = "view";
    activeTodoHighlightedLine = null;
    activeTodoTaskText = null;
  }
  content.classList.toggle("has-todo-split", Boolean(activeNote));

  content.innerHTML = `<div class="todo-view-layout ${activeNote ? "has-panel-open" : ""}" id="todo-view-layout"><div class="todo-list-pane"><div class="page-head"><div><h1>${s.todosTitle}</h1><p class="lede">${s.todosLede}</p></div><div class="todo-group-tabs" role="tablist" aria-label="${escapeHtml(s.todoGroupBy)}"><button type="button" role="tab" data-todo-group="date" class="${grouping === "date" ? "is-active" : ""}" aria-selected="${grouping === "date"}">${s.todoGroupDate}</button><button type="button" role="tab" data-todo-group="tag" class="${grouping === "tag" ? "is-active" : ""}" aria-selected="${grouping === "tag"}">${s.todoGroupTag}</button><button type="button" role="tab" data-todo-group="all" class="${grouping === "all" ? "is-active" : ""}" aria-selected="${grouping === "all"}">${s.todoGroupAll}</button></div></div><div class="todo-groups-container">${groups
    .map(
      (group) => `<section class="todo-group" data-group-id="${group.id}">${group.title ? `<header class="todo-group-header"><h2 class="todo-group-title"><span>${escapeHtml(group.title)}</span><span class="todo-group-count">${group.count}</span></h2></header>` : ""}<ul class="todo-list">${group.tasks
        .map((task) => todoItemMarkup(task, task.note.id === activeTodoNoteId))
        .join("")}</ul></section>`
    )
    .join("")}</div></div><div class="todo-panel-scrim" id="todo-panel-scrim" aria-hidden="true"></div><aside class="todo-side-panel ${activeNote ? "is-open" : ""}" id="todo-side-panel" role="complementary" aria-label="${escapeHtml(s.linkedNotePanel)}" ${activeNote ? 'aria-hidden="false"' : 'aria-hidden="true"'}>${activeNote ? (activeTodoSidePanelMode === "edit" ? renderTodoSidePanelEdit(activeNote) : renderTodoSidePanelView(activeNote, allNotes, activeTodoTaskText)) : ""}</aside></div>`;

  if (activeNote) {
    if (activeTodoSidePanelMode === "edit") {
      bindSidePanelEditMode(content, activeNote, allNotes);
    } else {
      bindSidePanelViewMode(content, activeNote, allNotes);
    }
  }

  content.querySelector<HTMLElement>("#todo-panel-scrim")?.addEventListener("click", () => {
    closeTodoSidePanel(content);
  });

  content.querySelectorAll<HTMLAnchorElement>("[data-open-note]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      const noteId = link.dataset.openNote;
      if (!noteId) return;
      const taskLine = Number(link.dataset.taskLine);
      activeTodoNoteId = noteId;
      activeTodoHighlightedLine = Number.isNaN(taskLine) ? null : taskLine;
      activeTodoTaskText = link.dataset.taskText ?? null;
      activeTodoSidePanelMode = "view";
      updateTodoSidePanel(content, allNotes);
    });
  });

  content.querySelectorAll<HTMLButtonElement>("[data-todo-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextGroup = (btn.dataset.todoGroup as TodoGrouping) || "date";
      try {
        localStorage.setItem("rook_todos_grouping", nextGroup);
      } catch {
        // ignore
      }
      const nextUrl = new URL(location.href);
      if (nextGroup === "date") {
        nextUrl.searchParams.delete("group");
      } else {
        nextUrl.searchParams.set("group", nextGroup);
      }
      history.replaceState({}, "", nextUrl.pathname + nextUrl.search);
      void renderTodos(content);
    });
  });

  content.querySelectorAll<HTMLInputElement>("[data-task-note]").forEach((input) =>
    input.addEventListener("change", async () => {
      input.disabled = true;
      const item = input.closest<HTMLElement>(".todo-item");
      if (item) {
        item.classList.add("is-completing");
      }
      const isReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const animationWait = isReducedMotion ? 40 : 700;

      const savePromise = notes.setTaskDone(input.dataset.taskNote ?? "", Number(input.dataset.taskLine), input.checked);

      try {
        await Promise.all([
          savePromise,
          new Promise((resolve) => setTimeout(resolve, animationWait))
        ]);
        await renderRoute();
      } catch (error) {
        if (item) {
          item.classList.remove("is-completing");
        }
        input.checked = false;
        input.disabled = false;
        alert(errorMessage(error));
      }
    })
  );
}
