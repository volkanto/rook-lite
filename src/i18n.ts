import type { LocaleDefinition, TranslationStrings } from "./i18n.types";

export type { LocaleDefinition, TranslationStrings } from "./i18n.types";
export type SupportedLocale = string;

interface LocaleModule {
  default?: LocaleDefinition;
  locale?: LocaleDefinition;
  [key: string]: unknown;
}

// Automatically detect and load all locale files in ./locales/*.ts
const rawModules = import.meta.glob<LocaleModule>("./locales/*.ts", { eager: true });

const registeredLocales = new Map<string, LocaleDefinition>();

for (const [filePath, mod] of Object.entries(rawModules)) {
  const match = filePath.match(/\/([^/]+)\.ts$/);
  const fallbackCode = match ? match[1] : "";
  const def = (mod.default || mod.locale || mod) as LocaleDefinition;
  if (def && typeof def.strings === "object") {
    const rawCode = def.code || fallbackCode;
    const item: LocaleDefinition = {
      ...def,
      code: rawCode
    };
    registeredLocales.set(rawCode, item);
    if (rawCode.toLowerCase() !== rawCode) {
      registeredLocales.set(rawCode.toLowerCase(), item);
    }
  }
}

// Ensure default locale fallback
const DEFAULT_LOCALE = registeredLocales.has("en")
  ? "en"
  : (registeredLocales.keys().next().value ?? "en");

const PREFERRED_LOCALE_ORDER = ["en", "de", "es", "tr", "pt-BR", "fr"];

export function getAvailableLocales(): LocaleDefinition[] {
  const list = Array.from(new Set(registeredLocales.values()));
  return list.sort((a, b) => {
    const idxA = PREFERRED_LOCALE_ORDER.indexOf(a.code);
    const idxB = PREFERRED_LOCALE_ORDER.indexOf(b.code);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function getLocaleDefinition(code = getLocale()): LocaleDefinition {
  return (
    registeredLocales.get(code) ??
    registeredLocales.get(code.toLowerCase()) ??
    registeredLocales.get(DEFAULT_LOCALE)!
  );
}

const STORAGE_KEY = "language-preference";

export function getLocale(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (registeredLocales.has(saved) || registeredLocales.has(saved.toLowerCase()))) {
      return (registeredLocales.get(saved) ?? registeredLocales.get(saved.toLowerCase()))!.code;
    }
  } catch {
    // Ignore localStorage errors
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    const navLang = navigator.language.toLowerCase();
    for (const [key, item] of registeredLocales.entries()) {
      if (navLang.startsWith(key) || key.startsWith(navLang)) return item.code;
    }
  }
  return DEFAULT_LOCALE;
}

export function setLocale(localeCode: string): void {
  const code =
    registeredLocales.get(localeCode)?.code ??
    registeredLocales.get(localeCode.toLowerCase())?.code ??
    DEFAULT_LOCALE;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Ignore localStorage errors
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
  }
}

export function currentStrings(): TranslationStrings {
  return getLocaleDefinition().strings;
}

export const translations = new Proxy({} as Record<string, TranslationStrings>, {
  get(_target, prop: string) {
    return (
      registeredLocales.get(prop)?.strings ??
      registeredLocales.get(prop.toLowerCase())?.strings ??
      registeredLocales.get(DEFAULT_LOCALE)?.strings
    );
  },
  has(_target, prop: string) {
    return registeredLocales.has(prop) || registeredLocales.has(prop.toLowerCase());
  },
  ownKeys() {
    return Array.from(new Set(Array.from(registeredLocales.values()).map((l) => l.code)));
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const item = registeredLocales.get(prop) ?? registeredLocales.get(prop.toLowerCase());
    if (item) {
      return {
        configurable: true,
        enumerable: true,
        value: item.strings
      };
    }
    return undefined;
  }
});

function getDateTimeLocale(code = getLocale()): string {
  const def = registeredLocales.get(code) ?? registeredLocales.get(code.toLowerCase());
  if (def?.dateTimeLocale) return def.dateTimeLocale;
  const lower = code.toLowerCase();
  if (lower === "tr") return "tr-TR";
  if (lower === "en") return "en-US";
  if (lower === "de") return "de-DE";
  if (lower === "es") return "es-ES";
  if (lower === "fr") return "fr-FR";
  if (lower === "pt-br") return "pt-BR";
  return code;
}

export function formatDateHeading(dateIso: string, code = getLocale()): string {
  const date = new Date(`${dateIso}T12:00:00`);
  return new Intl.DateTimeFormat(getDateTimeLocale(code), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatShortDate(dateIso: string, code = getLocale()): string {
  const date = new Date(`${dateIso}T12:00:00`);
  return new Intl.DateTimeFormat(getDateTimeLocale(code), {
    month: "short",
    day: "numeric"
  }).format(date);
}

export function formatMonthYear(date: Date, code = getLocale()): string {
  return new Intl.DateTimeFormat(getDateTimeLocale(code), {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function format24HourTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatTimeLocale(createdAt: string, noteDate: string, todayIso: string, code = getLocale()): string {
  const timeFormatted = format24HourTime(createdAt);
  const s = translations[code] ?? translations.en;

  const createdDate = new Date(createdAt);
  const isInvalid = Number.isNaN(createdDate.getTime());
  const createdIso = isInvalid
    ? noteDate
    : `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")}-${String(createdDate.getDate()).padStart(2, "0")}`;

  let dateLabel: string;
  if (createdIso === todayIso) {
    dateLabel = s.today;
  } else {
    const todayObj = new Date(`${todayIso}T12:00:00`);
    const yesterday = new Date(todayObj);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const tomorrow = new Date(todayObj);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    if (createdIso === yesterdayIso) {
      dateLabel = s.yesterday;
    } else if (createdIso === tomorrowIso) {
      dateLabel = s.tomorrow;
    } else {
      dateLabel = new Intl.DateTimeFormat(getDateTimeLocale(code), {
        month: "short",
        day: "numeric"
      }).format(isInvalid ? new Date(`${noteDate}T12:00:00`) : createdDate);
    }
  }

  return `${dateLabel} · ${timeFormatted}`;
}

export function formatLiveTime(date = new Date(), code = getLocale()): string {
  return new Intl.DateTimeFormat(getDateTimeLocale(code), {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function getRelativeDateInfo(dateIso: string, todayIso: string, code = getLocale()): { label: string; status: "today" | "past" | "future" } {
  const s = translations[code];
  if (dateIso === todayIso) {
    return { label: s.today, status: "today" };
  }
  const dateObj = new Date(`${dateIso}T12:00:00`);
  const todayObj = new Date(`${todayIso}T12:00:00`);
  const diffDays = Math.round((dateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === -1) {
    return { label: s.yesterday, status: "past" };
  }
  if (diffDays === 1) {
    return { label: s.tomorrow, status: "future" };
  }
  if (diffDays < 0) {
    return { label: s.daysAgo(Math.abs(diffDays)), status: "past" };
  }
  return { label: s.daysLater(diffDays), status: "future" };
}

export function getLocaleFlagSvg(localeCode: string): string {
  const code = localeCode.toLowerCase();
  switch (code) {
    case "en":
      return `<svg class="lang-flag-svg" viewBox="0 0 24 24" width="20" height="14" aria-hidden="true"><rect x="2" y="5" width="20" height="14" fill="#B22234"/><rect x="2" y="6.07" width="20" height="1.08" fill="#fff"/><rect x="2" y="8.23" width="20" height="1.08" fill="#fff"/><rect x="2" y="10.38" width="20" height="1.08" fill="#fff"/><rect x="2" y="12.54" width="20" height="1.08" fill="#fff"/><rect x="2" y="14.69" width="20" height="1.08" fill="#fff"/><rect x="2" y="16.85" width="20" height="1.08" fill="#fff"/><rect x="2" y="5" width="8" height="7.54" fill="#3C3B6E"/><circle cx="4" cy="7" r="0.45" fill="#fff"/><circle cx="6" cy="7" r="0.45" fill="#fff"/><circle cx="8" cy="7" r="0.45" fill="#fff"/><circle cx="5" cy="8.77" r="0.45" fill="#fff"/><circle cx="7" cy="8.77" r="0.45" fill="#fff"/><circle cx="4" cy="10.54" r="0.45" fill="#fff"/><circle cx="6" cy="10.54" r="0.45" fill="#fff"/><circle cx="8" cy="10.54" r="0.45" fill="#fff"/></svg>`;
    case "de":
      return `<svg class="lang-flag-svg" viewBox="0 0 24 24" width="20" height="14" aria-hidden="true"><rect x="2" y="5" width="20" height="4.67" fill="#111"/><rect x="2" y="9.67" width="20" height="4.67" fill="#DD0000"/><rect x="2" y="14.33" width="20" height="4.67" fill="#FFCE00"/></svg>`;
    case "es":
      return `<svg class="lang-flag-svg" viewBox="0 0 24 24" width="20" height="14" aria-hidden="true"><rect x="2" y="5" width="20" height="14" fill="#AA151B"/><rect x="2" y="8.5" width="20" height="7" fill="#F1BF00"/><rect x="5.5" y="10" width="1.8" height="3" rx="0.5" fill="#AA151B"/></svg>`;
    case "tr":
      return `<svg class="lang-flag-svg" viewBox="0 0 24 24" width="20" height="14" aria-hidden="true"><rect x="2" y="5" width="20" height="14" fill="#E30A17"/><circle cx="10" cy="12" r="3.5" fill="#fff"/><circle cx="11" cy="12" r="2.8" fill="#E30A17"/><polygon points="14.5,12 15.8,12.4 16.5,11.2 16.2,12.6 17.5,13.1 16.1,13.3 16,14.7 15.3,13.5 14,13.8 15,12.8" fill="#fff"/></svg>`;
    case "pt-br":
      return `<svg class="lang-flag-svg" viewBox="0 0 24 24" width="20" height="14" aria-hidden="true"><rect x="2" y="5" width="20" height="14" fill="#009739"/><polygon points="12,6.5 20,12 12,17.5 4,12" fill="#FEDD00"/><circle cx="12" cy="12" r="2.8" fill="#012169"/><path d="M9.4 12a2.8 2.8 0 0 0 5.2 -.5a2.8 2.8 0 0 1 -5.2 .5" fill="#fff"/></svg>`;
    case "fr":
      return `<svg class="lang-flag-svg" viewBox="0 0 24 24" width="20" height="14" aria-hidden="true"><rect x="2" y="5" width="6.67" height="14" fill="#002395"/><rect x="8.67" y="5" width="6.67" height="14" fill="#fff"/><rect x="15.34" y="5" width="6.67" height="14" fill="#ED2939"/></svg>`;
    default:
      return "";
  }
}
