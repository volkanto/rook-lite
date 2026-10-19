export type NotePreviewDensity = "compact" | "comfortable" | "full";

export const NOTE_PREVIEW_DENSITY_KEY = "rook_note_preview_density";

export function getNotePreviewDensity(): NotePreviewDensity {
  try {
    const saved = localStorage.getItem(NOTE_PREVIEW_DENSITY_KEY);
    if (saved === "compact" || saved === "comfortable" || saved === "full") {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "comfortable";
}

export function setNotePreviewDensity(density: NotePreviewDensity): void {
  try {
    localStorage.setItem(NOTE_PREVIEW_DENSITY_KEY, density);
  } catch {
    // Ignore localStorage errors
  }
  applyNotePreviewDensity();
}

export function applyNotePreviewDensity(): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.noteDensity = getNotePreviewDensity();
  }
}
