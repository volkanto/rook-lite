import { getLocale } from "../i18n";
import { getPredefinedTemplates } from "../templates";
import type { Command, CommandActions, CommandContext } from "./types";

const TURKISH_COMMAND_TEXT: Record<string, { title: string; description: string; keywords?: string[] }> = {
  "contextual-edit-note": {
    title: "Notu düzenle",
    description: "Etkin veya seçili notu düzenleyin",
    keywords: ["düzenle", "not", "yaz", "değiştir"]
  },
  "contextual-copy-note": {
    title: "Notun Markdown'ını kopyala",
    description: "Seçili notun içeriğini panoya kopyalayın",
    keywords: ["kopyala", "pano", "markdown", "metin"]
  },
  "contextual-delete-note": {
    title: "Notu sil",
    description: "Seçili notu silin",
    keywords: ["sil", "kaldır", "çöp"]
  },
  "contextual-regenerate-summary": {
    title: "Özeti yeniden oluştur",
    description: "Geçerli dönem için özeti tekrar oluşturun",
    keywords: ["özet", "yeniden", "yapay zeka", "tazele"]
  },
  "contextual-copy-summary": {
    title: "Özeti kopyala",
    description: "Oluşturulan özeti panoya kopyalayın",
    keywords: ["kopyala", "pano", "özet"]
  },
  "contextual-download-summary": {
    title: "Özet Markdown'ını indir",
    description: "Özeti Markdown dosyası olarak dışa aktarın",
    keywords: ["indir", "kaydet", "özet", "dışa aktar"]
  },
  "new-note": {
    title: "Yeni not",
    description: "Yeni bir not yazın",
    keywords: ["yeni", "oluştur", "yaz", "not", "taslak"]
  },
  "today": {
    title: "Bugüne git",
    description: "Bugünün not akışına geçin",
    keywords: ["bugün", "şimdi", "günlük", "ana sayfa"]
  },
  "open-tasks": {
    title: "Açık görevler",
    description: "Notlarınızdaki tüm tamamlanmamış kontrol listesi maddelerini görün",
    keywords: ["görev", "yapılacaklar", "kontrol listesi", "açık görevler"]
  },
  "filter-tags": {
    title: "Etikete göre filtrele",
    description: "Notları etikete göre arayın",
    keywords: ["etiket", "kategori", "filtrele", "konu"]
  },
  "review-this-week": {
    title: "Bu haftayı incele",
    description: "Bu hafta için haftalık özet oluşturun veya görüntüleyin",
    keywords: ["özet", "haftalık", "bu hafta", "incele"]
  },
  "review-this-month": {
    title: "Bu ayı incele",
    description: "Bu ay için aylık özet oluşturun veya görüntüleyin",
    keywords: ["özet", "aylık", "bu ay", "incele"]
  },
  "open-latest-summary": {
    title: "En son özeti aç",
    description: "Özetler paneline gidin",
    keywords: ["son özet", "özetler", "genel bakış"]
  },
  "custom-review": {
    title: "Özel dönem incelemesi",
    description: "Özel bir tarih aralığı için özet oluşturun",
    keywords: ["özel özet", "tarih aralığı", "özel inceleme"]
  },
  "go-to-date": {
    title: "Tarihe git",
    description: "Belirli bir takvim tarihine geçin",
    keywords: ["tarihe git", "takvim", "gün", "tarih seç"]
  },
  "previous-day": {
    title: "Önceki gün",
    description: "Düne veya önceki güne gidin",
    keywords: ["önceki gün", "dün", "geri", "önce"]
  },
  "next-day": {
    title: "Sonraki gün",
    description: "Yarına veya sonraki güne gidin",
    keywords: ["sonraki gün", "yarın", "ileri", "sonra"]
  },
  "export-markdown-zip": {
    title: "Markdown dışa aktar (ZIP)",
    description: "Tüm notları ön bilgilerle birlikte ZIP arşivi olarak indirin",
    keywords: ["dışa aktar", "markdown", "indir", "zip", "yedekle"]
  },
  "create-json-backup": {
    title: "JSON yedeği oluştur",
    description: "Notların, kategorilerin ve özetlerin tam bir JSON anlık görüntüsünü kaydedin",
    keywords: ["yedek", "json", "dışa aktar", "veriyi kaydet"]
  },
  "restore-backup": {
    title: "Yedeği geri yükle",
    description: "Bir JSON yedek dosyasını içe aktarın ve geri yükleyin",
    keywords: ["geri yükle", "içe aktar", "yükle", "yedek yükle"]
  },
  "toggle-theme": {
    title: "Temayı değiştir",
    description: "Açık ve koyu görünüm arasında geçiş yapın",
    keywords: ["tema", "koyu", "açık", "mod"]
  },
  "set-theme-light": {
    title: "Temayı ayarla: Açık",
    description: "Açık arayüz modunu kullanın",
    keywords: ["tema", "açık", "gündüz", "beyaz"]
  },
  "set-theme-dark": {
    title: "Temayı ayarla: Koyu",
    description: "Koyu arayüz modunu kullanın",
    keywords: ["tema", "koyu", "gece", "siyah"]
  },
  "set-theme-system": {
    title: "Temayı ayarla: Sistem",
    description: "İşletim sistemi açık/koyu tercihine uyun",
    keywords: ["tema", "sistem", "otomatik"]
  },
  "toggle-zen-mode": {
    title: "Zen modunu aç/kapat",
    description: "Yazma alanını genişletin ve gezinmeyi gizleyin",
    keywords: ["zen", "odak", "tam ekran", "dikkat dağıtmayan"]
  },
  "keyboard-shortcuts": {
    title: "Klavye Kısayolları",
    description: "Tüm klavye gezintisi ve düzenleme kısayollarını görüntüleyin",
    keywords: ["kısayollar", "yardım", "tuşlar", "klavye"]
  },
  "open-settings": {
    title: "Ayarları Aç",
    description: "Tercihleri ve görünümü yapılandırın",
    keywords: ["ayarlar", "tercihler", "seçenekler"]
  },
  "ai-settings": {
    title: "Yapay Zeka ve Ollama ayarları",
    description: "Yerel Ollama ayarlarını görüntüleyin",
    keywords: ["yapay zeka", "ai", "ollama", "model"]
  },
  "data-management": {
    title: "Veri yönetimi",
    description: "Dışa aktarma, yedekleme ve depolama bilgileri",
    keywords: ["depolama", "veri", "yedek", "dışa aktar"]
  },
  "export-markdown-dir": {
    title: "Klasöre dışa aktar",
    description: "Markdown dosyalarını doğrudan yerel bir klasöre aktarın",
    keywords: ["dışa aktar", "klasör", "dizin", "yerel dosyalar"]
  }
};

export function createCommandRegistry(actions: CommandActions, locale = getLocale()): Command[] {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl+";
  const templates = getPredefinedTemplates(locale);
  const templatePrefix = locale === "tr" ? "Şablon" : "Template";

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
      keywords: ["tags", "topics", "hashtags", "filter tags"],
      group: "notes",
      execute: () => actions.openSearch?.("tag:")
    },

    // --- Templates ---
    ...templates.map((tmpl) => ({
      id: `template-${tmpl.id}`,
      title: `${templatePrefix}: ${tmpl.name}`,
      description: tmpl.description,
      keywords: [templatePrefix.toLowerCase(), "template", tmpl.name.toLowerCase(), tmpl.id, ...tmpl.tags, "insert", "snippet", "boilerplate"],
      group: "notes" as const,
      execute: () => actions.insertTemplate?.(tmpl.markdown)
    })),

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
      description: "Save a full JSON snapshot of notes and summaries",
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

  if (locale === "tr") {
    for (const cmd of commands) {
      const tr = TURKISH_COMMAND_TEXT[cmd.id];
      if (tr) {
        cmd.title = tr.title;
        cmd.description = tr.description;
        if (tr.keywords) {
          cmd.keywords = [...(cmd.keywords ?? []), ...tr.keywords];
        }
      }
    }
  }

  return commands;
}
