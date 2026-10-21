export type NotesPageLayout = "one-column" | "two-columns";

export const NOTES_PAGE_LAYOUT_KEY = "rook_notes_page_layout";

export function getNotesPageLayout(): NotesPageLayout {
  try {
    const saved = localStorage.getItem(NOTES_PAGE_LAYOUT_KEY);
    if (saved === "one-column" || saved === "two-columns") {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "one-column";
}

export function setNotesPageLayout(layout: NotesPageLayout): void {
  try {
    localStorage.setItem(NOTES_PAGE_LAYOUT_KEY, layout);
  } catch {
    // Ignore localStorage errors
  }
  applyNotesPageLayout();
}

export function applyNotesPageLayout(): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.notesLayout = getNotesPageLayout();
  }
}
