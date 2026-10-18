import { track } from "../analytics/analytics";
import { currentStrings } from "../i18n";
import { appPath, appUrl } from "../routing";
import { renderRoute } from "../router";
import { showConfirm } from "./modals";
import { resizeEditor, setEditorMode, updateEditorWordCount } from "./toolbar";

export function applyTemplateText(form: HTMLFormElement, textarea: HTMLTextAreaElement, templateMarkdown: string): void {
  setEditorMode(form, "write", false);
  textarea.value = templateMarkdown;
  textarea.focus();
  resizeEditor(textarea);
  updateEditorWordCount(form);
  form.classList.add("has-content");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  void track("template_used");
}

export async function insertTemplateIntoEditor(templateMarkdown: string): Promise<void> {
  if (appPath() !== "/") {
    history.pushState({}, "", appUrl("/"));
    await renderRoute();
  }
  const form = (document.querySelector("#edit-note-form") ?? document.querySelector("#new-note-form")) as HTMLFormElement | null;
  if (!form) return;
  const textarea = form.querySelector<HTMLTextAreaElement>("textarea.simple-editor-textarea");
  if (!textarea) return;

  const current = textarea.value.trim();
  if (current) {
    const s = currentStrings();
    showConfirm(
      s.replaceTemplateTitle,
      s.replaceTemplateMessage,
      s.replaceTemplateBtn,
      async () => {
        applyTemplateText(form, textarea, templateMarkdown);
      }
    );
  } else {
    applyTemplateText(form, textarea, templateMarkdown);
  }
}
