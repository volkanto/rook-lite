import { currentStrings } from "./i18n";

export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

export function setTheme(theme: ThemePreference): void {
  localStorage.setItem("theme-preference", theme);
  applyTheme();
}

export function applyTheme(): void {
  const s = currentStrings();
  const theme = (localStorage.getItem("theme-preference") ?? "SYSTEM") as ThemePreference;
  const resolved = theme === "SYSTEM" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme.toLowerCase();
  document.documentElement.dataset.theme = resolved;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#121214" : "#F7F7FA");
  const toggle = document.querySelector<HTMLElement>(".sidebar-theme-toggle");
  if (toggle) {
    const nextLabel = resolved === "dark" ? s.themeToggleLight : s.themeToggleDark;
    toggle.setAttribute("aria-label", s.themeToggleAria);
    toggle.dataset.sidebarTooltip = nextLabel;
    const labelEl = toggle.querySelector(".theme-label");
    if (labelEl) labelEl.textContent = nextLabel;
  }
}
