import { currentStrings } from "../i18n";

export function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

export function errorMessage(error: unknown): string {
  const s = currentStrings();
  return error instanceof Error ? error.message : s.somethingWentWrong;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function status(form: HTMLFormElement, message: string, error = false): void {
  const element = form.querySelector<HTMLElement>("[data-save-status]");
  if (element) {
    element.textContent = message;
    element.classList.toggle("text-danger", error);
  }
}

export function setBusy(form: HTMLFormElement, busy: boolean, successMessage?: string): void {
  form.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.disabled = busy;
  });

  const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");
  if (!submitBtn) return;

  if (busy) {
    if (!submitBtn.dataset.originalContent) {
      submitBtn.dataset.originalContent = submitBtn.innerHTML;
    }
    submitBtn.setAttribute("aria-busy", "true");
    submitBtn.classList.add("is-busy");
    const s = currentStrings();
    const label = s.savingDraft || "Saving…";
    submitBtn.innerHTML = `<svg class="save-spinner" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-dasharray="38" stroke-linecap="round" fill="none" /></svg><span>${label}</span>`;
  } else {
    submitBtn.removeAttribute("aria-busy");
    submitBtn.classList.remove("is-busy");
    if (successMessage) {
      submitBtn.classList.add("is-saved");
      submitBtn.innerHTML = `<svg class="save-success-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5l10 -10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg><span>${successMessage}</span>`;
      const original = submitBtn.dataset.originalContent;
      window.setTimeout(() => {
        submitBtn.classList.remove("is-saved");
        if (original && submitBtn.dataset.originalContent === original) {
          submitBtn.innerHTML = original;
          delete submitBtn.dataset.originalContent;
        }
      }, 1400);
    } else if (submitBtn.dataset.originalContent) {
      submitBtn.innerHTML = submitBtn.dataset.originalContent;
      delete submitBtn.dataset.originalContent;
    }
  }
}

export function updateScrollToTopVisibility(): void {
  const footer = document.querySelector<HTMLElement>(".notes-stream-footer");
  if (!footer) return;
  const notesList = document.querySelector<HTMLElement>(".notes-list");
  if (!notesList) {
    footer.classList.add("is-hidden");
    footer.setAttribute("hidden", "");
    return;
  }
  const shell = document.querySelector<HTMLElement>(".shell");
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const docOverflows = document.documentElement.scrollHeight > viewportHeight + 40;
  const shellOverflows = shell ? shell.scrollHeight > shell.clientHeight + 40 : false;
  const listRect = notesList.getBoundingClientRect();
  const listOverflows = listRect.bottom > viewportHeight + 40;
  const isScrollable = docOverflows || shellOverflows || listOverflows;

  if (isScrollable) {
    footer.classList.remove("is-hidden");
    footer.removeAttribute("hidden");
  } else {
    footer.classList.add("is-hidden");
    footer.setAttribute("hidden", "");
  }
}
