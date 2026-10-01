import type { Command, CommandActions, CommandContext } from "./types";

export function createCommandRegistry(actions: CommandActions): Command[] {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl+";

  const commands: Command[] = [
    // --- Contextual: Current Note ---
    {
      id: "contextual-edit-note",
      title: "Edit note",
      description: "Edit the active or selected note",
      keywords: ["edit", "modify", "change", "write", "note"],
      group: "contextual",
      isAvailable: (ctx: CommandContext) => Boolean(ctx.selectedNote),
      execute: (ctx: CommandContext) => {
        if (ctx.selectedNote && actions.editSelectedNote) {
          actions.editSelectedNote(ctx.selectedNote);
        }
      }
    },
    {
      id: "contextual-copy-note",
      title: "Copy note Markdown",
      description: "Copy content of selected note to clipboard",
      keywords: ["copy", "clipboard", "markdown", "text", "share"],
      group: "contextual",
      isAvailable: (ctx: CommandContext) => Boolean(ctx.selectedNote),
      execute: (ctx: CommandContext) => {
        if (ctx.selectedNote && actions.copySelectedNote) {
          actions.copySelectedNote(ctx.selectedNote);
        }
      }
    },
    {
      id: "contextual-delete-note",
      title: "Delete note",
      description: "Delete the selected note",
      keywords: ["delete", "remove", "trash", "destroy"],
      group: "contextual",
      isAvailable: (ctx: CommandContext) => Boolean(ctx.selectedNote),
      execute: (ctx: CommandContext) => {
        if (ctx.selectedNote && actions.deleteSelectedNote) {
          actions.deleteSelectedNote(ctx.selectedNote);
        }
      }
    },

    // --- Contextual: Current Summary ---
    {
      id: "contextual-regenerate-summary",
      title: "Regenerate summary",
      description: "Re-run summary generation for current period",
      keywords: ["regenerate", "re-run", "recreate", "ai summary", "refresh"],
      group: "contextual",
      isAvailable: (ctx: CommandContext) => ctx.currentPath.startsWith("/summaries"),
      execute: () => {
        actions.regenerateSummary?.();
      }
    },
    {
      id: "contextual-copy-summary",
      title: "Copy summary Markdown",
      description: "Copy generated summary to clipboard",
      keywords: ["copy", "clipboard", "summary", "markdown"],
      group: "contextual",
      isAvailable: (ctx: CommandContext) => ctx.currentPath.startsWith("/summaries") && Boolean(ctx.hasSummary),
      execute: () => {
        actions.copySummary?.();
      }
    },
    {
      id: "contextual-download-summary",
      title: "Download summary Markdown",
      description: "Export summary as a markdown file",
      keywords: ["export", "download", "save", "summary", "markdown"],
      group: "contextual",
      isAvailable: (ctx: CommandContext) => ctx.currentPath.startsWith("/summaries") && Boolean(ctx.hasSummary),
      execute: () => {
        actions.downloadSummary?.();
      }
    },

    // --- Notes ---
    {
      id: "new-note",
      title: "New note",
      description: "Compose a new note",
      keywords: ["new", "create", "compose", "write", "draft", "add", "note"],
      shortcut: `${modKey}N`,
      group: "notes",
      execute: () => actions.createNote()
    },
    {
      id: "today",
      title: "Go to today",
      description: "Jump to today's notes stream",
      keywords: ["today", "now", "current day", "daily", "home"],
      group: "notes",
      execute: () => actions.navigateTo("/")
    },
    {
      id: "open-tasks",
      title: "Open tasks",
      description: "View all unfinished checklist items across your notes",
      keywords: ["todo", "tasks", "open tasks", "checklist", "action items", "uncompleted"],
      group: "notes",
      execute: () => actions.openTasks()
    },
    {
      id: "filter-tags",
      title: "Filter notes by tag",
      description: "Search notes by hashtag",
      keywords: ["tags", "topics", "hashtags", "filter tags", "categories"],
      group: "notes",
      execute: () => actions.openSearch?.("tag:")
    },

    // --- Summaries ---
    {
      id: "review-this-week",
      title: "Review this week",
      description: "Generate or view weekly summary for the current week",
      keywords: ["summary", "weekly", "this week", "review", "digest", "week"],
      group: "summaries",
      execute: () => actions.navigateTo("/summaries?type=weekly")
    },
    {
      id: "review-this-month",
      title: "Review this month",
      description: "Generate or view monthly summary for the current month",
      keywords: ["summary", "monthly", "this month", "review", "digest", "month"],
      group: "summaries",
      execute: () => actions.navigateTo("/summaries?type=monthly")
    },
    {
      id: "open-latest-summary",
      title: "Open latest summary",
      description: "Navigate to summaries dashboard",
      keywords: ["latest summary", "recent summary", "overview", "summaries"],
      group: "summaries",
      execute: () => actions.navigateTo("/summaries")
    },
    {
      id: "custom-review",
      title: "Custom review",
      description: "Create a summary for a custom date range",
      keywords: ["custom summary", "date range", "summary range", "custom review"],
      group: "summaries",
      execute: () => actions.navigateTo("/summaries?type=custom")
    },

    // --- Navigation ---
    {
      id: "go-to-date",
      title: "Go to date",
      description: "Jump to a specific calendar date",
      keywords: ["jump to date", "calendar", "day", "date picker", "pick date"],
      group: "navigation",
      execute: () => actions.openDatePicker()
    },
    {
      id: "previous-day",
      title: "Previous day",
      description: "Navigate to yesterday or previous day",
      keywords: ["previous day", "yesterday", "prev", "back", "earlier"],
      group: "navigation",
      execute: () => actions.shiftDate(-1)
    },
    {
      id: "next-day",
      title: "Next day",
      description: "Navigate to tomorrow or next day",
      keywords: ["next day", "tomorrow", "forward", "later"],
      group: "navigation",
      execute: () => actions.shiftDate(1)
    },

    // --- Data ---
    {
      id: "export-markdown-zip",
      title: "Export Markdown (Zip)",
      description: "Download all notes in a zip archive with frontmatter",
      keywords: ["export", "markdown", "download", "zip", "save notes", "backup notes"],
      group: "data",
      execute: () => actions.exportMarkdownZip()
    },
    {
      id: "create-json-backup",
      title: "Create JSON backup",
      description: "Save a full JSON snapshot of notes, categories, and summaries",
      keywords: ["backup", "json", "export backup", "save data", "download data", "snapshot"],
      group: "data",
      execute: () => actions.createBackup()
    },
    {
      id: "restore-backup",
      title: "Restore backup",
      description: "Import and restore a JSON backup file",
      keywords: ["restore", "import backup", "load data", "replace data", "upload backup"],
      group: "data",
      execute: () => actions.triggerRestoreBackup()
    },

    // --- Appearance ---
    {
      id: "toggle-theme",
      title: "Toggle theme",
      description: "Switch between light and dark appearance",
      keywords: ["theme", "dark", "light", "appearance", "mode", "toggle theme"],
      group: "appearance",
      execute: () => actions.toggleTheme()
    },
    {
      id: "set-theme-light",
      title: "Set theme: Light",
      description: "Use light interface mode",
      keywords: ["theme", "light", "bright", "white", "day"],
      group: "appearance",
      execute: () => actions.setTheme("LIGHT")
    },
    {
      id: "set-theme-dark",
      title: "Set theme: Dark",
      description: "Use dark interface mode",
      keywords: ["theme", "dark", "night", "black"],
      group: "appearance",
      execute: () => actions.setTheme("DARK")
    },
    {
      id: "set-theme-system",
      title: "Set theme: System",
      description: "Match operating system light/dark preference",
      keywords: ["theme", "system", "auto", "default theme"],
      group: "appearance",
      execute: () => actions.setTheme("SYSTEM")
    },
    {
      id: "toggle-zen-mode",
      title: "Toggle Zen mode",
      description: "Expand writing space and hide navigation",
      keywords: ["zen", "distraction free", "focus", "full screen", "maximize"],
      shortcut: `${modKey}D`,
      group: "appearance",
      execute: () => actions.toggleZen()
    },

    // --- Settings ---
    {
      id: "keyboard-shortcuts",
      title: "Keyboard Shortcuts",
      description: "View all keyboard navigation and editing shortcuts",
      keywords: ["shortcuts", "hotkeys", "cheat sheet", "help", "keys", "keyboard"],
      shortcut: "?",
      group: "settings",
      execute: () => actions.openShortcuts?.()
    },
    {
      id: "open-settings",
      title: "Open Settings",
      description: "Configure preferences and appearance",
      keywords: ["settings", "preferences", "config", "options"],
      group: "settings",
      execute: () => actions.navigateTo("/settings")
    },
    {
      id: "ai-settings",
      title: "AI & Ollama settings",
      description: "View local Ollama settings",
      keywords: ["ai", "ollama", "local ai", "model", "llama", "summary model", "ai settings"],
      group: "settings",
      execute: () => actions.navigateTo("/settings")
    },
    {
      id: "data-management",
      title: "Data management",
      description: "Export, backup, and storage information",
      keywords: ["storage", "data", "backup", "export", "data management", "indexeddb"],
      group: "settings",
      execute: () => actions.navigateTo("/settings#data-management-section")
    }
  ];

  if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
    commands.push({
      id: "export-markdown-dir",
      title: "Export to folder",
      description: "Export Markdown files directly to a local folder",
      keywords: ["export", "folder", "directory", "local files", "filesystem"],
      group: "data",
      execute: () => actions.exportMarkdownDirectory?.()
    });
  }

  return commands;
}
