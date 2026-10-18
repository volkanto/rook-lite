import { getTemplateById } from "../templates";
import { showLinkPickerModal } from "./modals";
import { insertTemplateIntoEditor } from "./template";

export function formatNote(textarea: HTMLTextAreaElement, style: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const formats: Record<string, [string, string]> = {
    heading: ["### ", ""],
    bold: ["**", "**"],
    italic: ["_", "_"],
    strike: ["~~", "~~"],
    list: ["* ", ""],
    numbered: ["1. ", ""],
    task: ["- [ ] ", ""],
    code: ["```\n", "\n```"],
    wikilink: ["[[", "]]"],
    quote: ["> ", ""]
  };
  const [rawPrefix, suffix] = formats[style] ?? ["", ""];
  const before = textarea.value.slice(0, start);
  const prefix = ["heading", "list", "numbered", "task", "quote"].includes(style) && before && !before.endsWith("\n") ? `\n${rawPrefix}` : rawPrefix;
  textarea.setRangeText(`${prefix}${selected}${suffix}`, start, end, "end");
  textarea.focus();
  textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export function handleSmartListContinuation(event: KeyboardEvent, textarea: HTMLTextAreaElement): boolean {
  if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
    return false;
  }
  if (event.defaultPrevented) {
    return false;
  }

  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart !== selectionEnd) {
    return false;
  }

  const cursorPos = selectionStart;
  const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
  const nextNewline = value.indexOf("\n", cursorPos);
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;
  const currentLine = value.slice(lineStart, lineEnd);

  const taskMatch = currentLine.match(/^([ \t]*)([-*+])\s+\[[ xX]\](?:\s+|$)/);
  const bulletMatch = !taskMatch ? currentLine.match(/^([ \t]*)([-*+])\s+/) : null;
  const numberMatch = !taskMatch && !bulletMatch ? currentLine.match(/^([ \t]*)(\d+)\.\s+/) : null;

  if (!taskMatch && !bulletMatch && !numberMatch) {
    return false;
  }

  const prefix = (taskMatch ?? bulletMatch ?? numberMatch)![0];
  const prefixLength = prefix.length;

  if (cursorPos < lineStart + prefixLength) {
    return false;
  }

  const contentAfterPrefix = currentLine.slice(prefixLength).trim();
  if (contentAfterPrefix === "") {
    event.preventDefault();
    textarea.setRangeText("", lineStart, lineEnd, "end");
    textarea.setSelectionRange(lineStart, lineStart);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  let continuationPrefix = "";
  if (taskMatch) {
    const indent = taskMatch[1];
    const bullet = taskMatch[2];
    continuationPrefix = `\n${indent}${bullet} [ ] `;
  } else if (bulletMatch) {
    const indent = bulletMatch[1];
    const bullet = bulletMatch[2];
    continuationPrefix = `\n${indent}${bullet} `;
  } else if (numberMatch) {
    const indent = numberMatch[1];
    const nextNum = parseInt(numberMatch[2], 10) + 1;
    continuationPrefix = `\n${indent}${nextNum}. `;
  }

  event.preventDefault();
  const newPos = cursorPos + continuationPrefix.length;
  textarea.setRangeText(continuationPrefix, cursorPos, cursorPos, "end");
  textarea.setSelectionRange(newPos, newPos);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

export function bindFormatting(form: HTMLFormElement, textarea: HTMLTextAreaElement): void {
  form.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.format === "wikilink") {
        void showLinkPickerModal(textarea);
      } else {
        formatNote(textarea, button.dataset.format ?? "");
      }
    });
  });
  form.querySelectorAll<HTMLButtonElement>("[data-insert-template]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tmpl = getTemplateById(btn.dataset.insertTemplate ?? "");
      if (tmpl) {
        void insertTemplateIntoEditor(tmpl.markdown);
        btn.closest("details")?.removeAttribute("open");
      }
    });
  });
  textarea.addEventListener("keydown", (event) => {
    handleSmartListContinuation(event, textarea);
  });
}
