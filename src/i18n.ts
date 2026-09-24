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
    const code = (def.code || fallbackCode).toLowerCase();
    registeredLocales.set(code, {
      ...def,
      code
    });
  }
}

// Ensure default locale fallback
const DEFAULT_LOCALE = registeredLocales.has("en")
  ? "en"
  : (registeredLocales.keys().next().value ?? "en");

export function getAvailableLocales(): LocaleDefinition[] {
  return Array.from(registeredLocales.values());
}

export function getLocaleDefinition(code = getLocale()): LocaleDefinition {
  return registeredLocales.get(code) ?? registeredLocales.get(DEFAULT_LOCALE)!;
}

const STORAGE_KEY = "language-preference";

export function getLocale(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && registeredLocales.has(saved)) return saved;
  } catch {
    // Ignore localStorage errors
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    const navLang = navigator.language.toLowerCase();
    for (const code of registeredLocales.keys()) {
      if (navLang.startsWith(code)) return code;
    }
  }
  return DEFAULT_LOCALE;
}

export function setLocale(localeCode: string): void {
  const code = registeredLocales.has(localeCode) ? localeCode : DEFAULT_LOCALE;
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
    return registeredLocales.get(prop)?.strings ?? registeredLocales.get(DEFAULT_LOCALE)?.strings;
  },
  has(_target, prop: string) {
    return registeredLocales.has(prop);
  },
  ownKeys() {
    return Array.from(registeredLocales.keys());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    if (registeredLocales.has(prop)) {
      return {
        configurable: true,
        enumerable: true,
        value: registeredLocales.get(prop)?.strings
      };
    }
    return undefined;
  }
});

function getDateTimeLocale(code = getLocale()): string {
  const def = registeredLocales.get(code);
  if (def?.dateTimeLocale) return def.dateTimeLocale;
  if (code === "tr") return "tr-TR";
  if (code === "en") return "en-US";
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

export function formatTimeLocale(createdAt: string, noteDate: string, todayIso: string, code = getLocale()): string {
  if (noteDate === todayIso) {
    return new Intl.DateTimeFormat(getDateTimeLocale(code), {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(createdAt));
  }
  return noteDate;
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
