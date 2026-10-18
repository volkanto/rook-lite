import { currentStrings } from "./i18n";
import { escapeHtml } from "./markdown";
import { appPath, appUrl, normalizeAppLinks } from "./routing";
import { errorMessage, requireElement } from "./utils/dom";

export type RouteHandler = (content: HTMLElement) => Promise<void> | void;

export interface RouterConfig {
  renderToday: RouteHandler;
  renderSearch: RouteHandler;
  renderSummariesV2: RouteHandler;
  renderTodos: RouteHandler;
  renderData: RouteHandler;
  renderSettings: RouteHandler;
  highlightLinkedNote: () => void;
  closeTodoSidePanel: (content: HTMLElement) => void;
  resetSummaryPeriodKey: () => void;
}

let routerConfig: RouterConfig | null = null;

export function configureRouter(config: RouterConfig): void {
  routerConfig = config;
}

export function renderNotFound(content: HTMLElement): void {
  const s = currentStrings();
  document.title = `${s.notFoundTitle} · Rook Lite`;
  content.innerHTML = `<div class="page-head"><div><p class="eyebrow">${s.notFoundDesc}</p><h1>${s.notFoundTitle}</h1><p class="lede"><a href="${appUrl("/")}" data-link>${s.notFoundReturnHome}</a></p></div></div>`;
}

export async function renderRoute(): Promise<void> {
  const content = requireElement<HTMLElement>("#page-content");
  const path = appPath();
  const activeEl = document.activeElement;
  const wasPrevBtn = Boolean(activeEl?.classList.contains("prev-btn") || activeEl?.closest(".prev-btn"));
  const wasNextBtn = Boolean(activeEl?.classList.contains("next-btn") || activeEl?.closest(".next-btn"));
  const wasDateJump = Boolean(activeEl?.classList.contains("typewriter-today-jump-btn") || activeEl?.closest(".typewriter-today-jump-btn"));
  const wasCalendarBtn = Boolean(activeEl?.classList.contains("minimal-calendar-btn") || activeEl?.closest(".minimal-calendar-btn"));

  if (routerConfig) {
    if (path !== "/summaries") {
      routerConfig.resetSummaryPeriodKey();
    }
    if (path !== "/todos") {
      routerConfig.closeTodoSidePanel(content);
    }
  }

  document.querySelectorAll<HTMLElement>("[data-path]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.path === "/" ? path === "/" : path.startsWith(link.dataset.path ?? ""));
  });

  try {
    if (routerConfig) {
      if (path === "/") {
        await routerConfig.renderToday(content);
      } else if (path === "/search") {
        await routerConfig.renderSearch(content);
      } else if (path === "/summaries") {
        await routerConfig.renderSummariesV2(content);
      } else if (path === "/todos") {
        await routerConfig.renderTodos(content);
      } else if (path === "/data") {
        await routerConfig.renderData(content);
      } else if (path === "/settings") {
        await routerConfig.renderSettings(content);
      } else {
        renderNotFound(content);
      }
    }
  } catch (error) {
    const isLockTimeout = error instanceof Error && (error.message.includes("timed out") || error.message.includes("locking"));
    if (isLockTimeout) {
      content.innerHTML = `<div class="empty-notes" style="padding: 3.5rem 1.5rem; text-align: center; max-width: 32rem; margin: 2rem auto;">
        <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--color-text-primary, var(--text));">Database Upgrade Pending</h3>
        <p style="color: var(--color-text-secondary, var(--text-soft)); line-height: 1.5; font-size: 0.9rem; margin-bottom: 1rem;">
          Another open tab or window of Rook Lite is currently using the database, which prevents the upgrade to support folders from completing.
        </p>
        <p style="color: var(--color-text-secondary, var(--text-soft)); line-height: 1.5; font-size: 0.88rem; margin-bottom: 1.5rem;">
          <strong>To continue:</strong> Please close any other open tabs or windows of Rook Lite, then click the button below.
        </p>
        <button type="button" class="btn-primary" onclick="location.reload()" style="padding: 0.6rem 1.35rem; font-size: 0.9rem; border-radius: 6px; cursor: pointer;">
          Refresh & Complete Upgrade
        </button>
      </div>`;
    } else {
      content.innerHTML = `<div class="empty-notes" style="padding:3rem 1.5rem; text-align:center;"><p class="notice error" style="margin-bottom:1rem;">${escapeHtml(errorMessage(error))}</p><button type="button" class="btn-primary" onclick="location.reload()">Reload</button></div>`;
    }
  }

  normalizeAppLinks();
  document.body.classList.remove("sidebar-drawer-open");

  if (wasPrevBtn) {
    content.querySelector<HTMLElement>(".prev-btn")?.focus({ preventScroll: true });
  } else if (wasNextBtn) {
    content.querySelector<HTMLElement>(".next-btn")?.focus({ preventScroll: true });
  } else if (wasCalendarBtn) {
    content.querySelector<HTMLElement>(".minimal-calendar-btn")?.focus({ preventScroll: true });
  } else if (!wasDateJump && path !== "/") {
    content.focus({ preventScroll: true });
  }

  if (routerConfig) {
    routerConfig.highlightLinkedNote();
  }
}
