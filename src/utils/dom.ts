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

export function setBusy(form: HTMLFormElement, busy: boolean): void {
  form.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.disabled = busy;
  });
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
