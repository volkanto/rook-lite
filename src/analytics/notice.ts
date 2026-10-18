import { icons, svg } from "../icons";
import { currentStrings } from "../i18n";
import { escapeHtml } from "../markdown";
import { appUrl } from "../routing";
import {
  dismissAnalyticsNotice,
  isAnalyticsEnabled,
  isAnalyticsNoticeDismissed
} from "./analytics";

export const ANALYTICS_NOTICE_ID = "privacy-notice-banner";

/**
 * Checks whether the analytics notification toast should be shown.
 * Returns true if analytics is enabled and the notice has not been dismissed.
 */
export async function shouldShowAnalyticsNotice(): Promise<boolean> {
  if (isAnalyticsNoticeDismissed()) {
    return false;
  }
  return await isAnalyticsEnabled();
}

/**
 * Removes any active analytics notice toast from the DOM.
 */
export function removeAnalyticsNotice(root: ParentNode = document): void {
  const notice =
    root.querySelector(`#${ANALYTICS_NOTICE_ID}`) ??
    root.querySelector("#analytics-notice") ??
    root.querySelector(".privacy-notice-toast") ??
    root.querySelector(".privacy-notice-banner") ??
    root.querySelector(".analytics-notice-banner");
  if (notice) {
    notice.remove();
  }
}

/**
 * Renders the floating bottom analytics notice toast into the host container.
 * If analytics is disabled or the notice was already dismissed, removes any existing toast.
 */
export async function renderAnalyticsNotice(container: HTMLElement): Promise<HTMLElement | null> {
  const shouldShow = await shouldShowAnalyticsNotice();
  if (!shouldShow) {
    removeAnalyticsNotice(container);
    return null;
  }

  const existing =
    container.querySelector<HTMLElement>(`#${ANALYTICS_NOTICE_ID}`) ??
    container.querySelector<HTMLElement>("#analytics-notice");
  if (existing) {
    return existing;
  }

  const s = currentStrings();
  const notice = document.createElement("aside");
  notice.id = ANALYTICS_NOTICE_ID;
  notice.className = "privacy-notice-toast privacy-notice-banner analytics-notice-banner";
  notice.setAttribute("role", "region");
  notice.setAttribute("aria-label", s.analyticsNoticeTitle);

  notice.innerHTML = `
    <div class="privacy-toast-header">
      <div class="privacy-toast-title-row">
        <span class="privacy-toast-sparkle" aria-hidden="true">${svg(icons.sparkle, "privacy-sparkle-svg")}</span>
        <strong class="privacy-toast-title">${escapeHtml(s.analyticsNoticeTitle)}</strong>
      </div>
      <button type="button" class="privacy-toast-close analytics-notice-close" data-action="dismiss-analytics-notice" aria-label="${escapeHtml(s.analyticsNoticeDismiss)}" title="${escapeHtml(s.analyticsNoticeDismiss)}">
        ${svg(icons.close, "privacy-close-svg")}
      </button>
    </div>
    <p class="privacy-toast-text analytics-notice-desc">${escapeHtml(s.analyticsNoticeDesc)}</p>
    <div class="privacy-toast-actions analytics-notice-actions">
      <a href="${appUrl("/settings#privacy")}" data-link class="privacy-toast-link">${escapeHtml(s.navSettings)}</a>
      <button type="button" class="privacy-toast-btn analytics-notice-btn" data-action="dismiss-analytics-notice">${escapeHtml(s.analyticsNoticeDismiss)}</button>
    </div>
  `;

  const handleDismiss = () => {
    dismissAnalyticsNotice();
    notice.classList.add("is-dismissing");
    setTimeout(() => {
      notice.remove();
    }, 200);
  };

  notice.querySelectorAll('[data-action="dismiss-analytics-notice"]').forEach((btn) => {
    btn.addEventListener("click", handleDismiss);
  });

  container.appendChild(notice);
  return notice;
}
