// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "./commandRegistry";
import type { CommandActions } from "./types";

const dummyActions: CommandActions = {
  navigateTo: vi.fn(),
  createNote: vi.fn(),
  openDatePicker: vi.fn(),
  shiftDate: vi.fn(),
  openTasks: vi.fn(),
  toggleTheme: vi.fn(),
  setTheme: vi.fn(),
  toggleZen: vi.fn(),
  exportMarkdownZip: vi.fn(),
  createBackup: vi.fn(),
  triggerRestoreBackup: vi.fn()
};

describe("commandRegistry localization", () => {
  it("provides English command titles, keywords, and template prefix", () => {
    const commands = createCommandRegistry(dummyActions, "en");

    const newNote = commands.find((c) => c.id === "new-note");
    expect(newNote?.title).toBe("New note");
    expect(newNote?.description).toBe("Compose a new note");
    expect(newNote?.keywords).toContain("create");

    const exportZip = commands.find((c) => c.id === "export-markdown-zip");
    expect(exportZip?.title).toBe("Export Markdown (Zip)");

    const templateCmd = commands.find((c) => c.id === "template-standup");
    expect(templateCmd?.title).toContain("Template:");
  });

  it("provides German command titles, keywords, and template prefix", () => {
    const commands = createCommandRegistry(dummyActions, "de");

    const newNote = commands.find((c) => c.id === "new-note");
    expect(newNote?.title).toBe("Neue Notiz");
    expect(newNote?.description).toBe("Eine neue Notiz verfassen");
    expect(newNote?.keywords).toContain("erstellen");

    const exportZip = commands.find((c) => c.id === "export-markdown-zip");
    expect(exportZip?.title).toBe("Markdown exportieren (ZIP)");

    const templateCmd = commands.find((c) => c.id === "template-standup");
    expect(templateCmd?.title).toContain("Vorlage:");
  });

  it("provides Spanish command titles, keywords, and template prefix", () => {
    const commands = createCommandRegistry(dummyActions, "es");

    const newNote = commands.find((c) => c.id === "new-note");
    expect(newNote?.title).toBe("Nueva nota");
    expect(newNote?.description).toBe("Redactar una nueva nota");
    expect(newNote?.keywords).toContain("crear");

    const exportZip = commands.find((c) => c.id === "export-markdown-zip");
    expect(exportZip?.title).toBe("Exportar Markdown (ZIP)");

    const templateCmd = commands.find((c) => c.id === "template-standup");
    expect(templateCmd?.title).toContain("Plantilla:");
  });

  it("provides French command titles, keywords, and template prefix", () => {
    const commands = createCommandRegistry(dummyActions, "fr");

    const newNote = commands.find((c) => c.id === "new-note");
    expect(newNote?.title).toBe("Nouvelle note");
    expect(newNote?.description).toBe("Rédiger une nouvelle note");
    expect(newNote?.keywords).toContain("créer");

    const exportZip = commands.find((c) => c.id === "export-markdown-zip");
    expect(exportZip?.title).toBe("Exporter en Markdown (ZIP)");

    const templateCmd = commands.find((c) => c.id === "template-standup");
    expect(templateCmd?.title).toContain("Modèle:");
  });

  it("provides Brazilian Portuguese command titles, keywords, and template prefix", () => {
    const commands = createCommandRegistry(dummyActions, "pt-BR");

    const newNote = commands.find((c) => c.id === "new-note");
    expect(newNote?.title).toBe("Nova nota");
    expect(newNote?.description).toBe("Escreva uma nova nota");
    expect(newNote?.keywords).toContain("criar");

    const exportZip = commands.find((c) => c.id === "export-markdown-zip");
    expect(exportZip?.title).toBe("Exportar Markdown (ZIP)");

    const templateCmd = commands.find((c) => c.id === "template-standup");
    expect(templateCmd?.title).toContain("Modelo:");
  });

  it("provides Turkish command titles, keywords, and template prefix", () => {
    const commands = createCommandRegistry(dummyActions, "tr");

    const newNote = commands.find((c) => c.id === "new-note");
    expect(newNote?.title).toBe("Yeni not");
    expect(newNote?.description).toBe("Yeni bir not yazın");
    expect(newNote?.keywords).toContain("oluştur");

    const exportZip = commands.find((c) => c.id === "export-markdown-zip");
    expect(exportZip?.title).toBe("Markdown dışa aktar (ZIP)");

    const templateCmd = commands.find((c) => c.id === "template-standup");
    expect(templateCmd?.title).toContain("Şablon:");
  });
});
