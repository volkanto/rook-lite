/**
 * Rook Lite Landing Page Interactive Logic
 * Inspired by usememos.com - Clean, Vanilla JS, Zero external tracker dependencies
 */

(function () {
  'use strict';

  // --- 1. Theme Management (Light / Dark / System) ---
  const THEME_KEY = 'rook-theme-preference';

  function safeGetStorage(key) {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function safeSetStorage(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {}
  }

  function getSavedTheme() {
    return safeGetStorage(THEME_KEY) || 'system';
  }

  function resolveTheme(preference) {
    if (preference === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    }
    return preference;
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;

    // Update toggle buttons and selects
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach((btn) => {
      const isDark = resolved === 'dark';
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = isDark
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    });

    const themeSelect = document.getElementById('footer-theme-select');
    if (themeSelect) {
      themeSelect.value = preference;
    }
  }

  function initTheme() {
    const saved = getSavedTheme();
    applyTheme(saved);

    // Listen to OS theme changes if on 'system' and matchMedia is supported
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (getSavedTheme() === 'system') {
            applyTheme('system');
          }
        });
      } catch (e) {}
    }

    // Theme toggle button click handler
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        safeSetStorage(THEME_KEY, next);
        applyTheme(next);
      });
    });

    // Footer theme selector
    const themeSelect = document.getElementById('footer-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        const chosen = e.target.value;
        safeSetStorage(THEME_KEY, chosen);
        applyTheme(chosen);
      });
    }
  }

  // --- 2. Interactive App Mockup Showcase Tabs & Rail ---
  function initMockupTabs() {
    const tabButtons = document.querySelectorAll('.mockup-tab-btn');
    const railButtons = document.querySelectorAll('.mockup-rail-btn[data-tab]');
    const panes = document.querySelectorAll('.mockup-view-pane');
    const addressbarPath = document.getElementById('mockup-addressbar-path');

    const pathMap = {
      'notes': '/notes',
      'summaries': '/summaries?period=week',
      'backups': '/settings/backups'
    };

    function activateTab(tabId) {
      // Update top tab buttons
      tabButtons.forEach((btn) => {
        const isActive = btn.getAttribute('data-tab') === tabId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // Update rail buttons
      railButtons.forEach((btn) => {
        const isActive = btn.getAttribute('data-tab') === tabId;
        btn.classList.toggle('active', isActive);
      });

      // Show matching pane
      panes.forEach((pane) => {
        const matches = pane.id === `pane-${tabId}`;
        pane.classList.toggle('active', matches);
      });

      // Update address bar text
      if (addressbarPath && pathMap[tabId]) {
        addressbarPath.textContent = pathMap[tabId];
      }
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        if (target) activateTab(target);
      });
    });

    railButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        if (target) activateTab(target);
      });
    });
  }

  // --- 3. Interactive Mockup Checklist Checkboxes ---
  function initMockupChecklist() {
    const checklistItems = document.querySelectorAll('.interactive-task-item');
    const taskCountEl = document.getElementById('mockup-completed-task-count');

    function updateCompletedCount() {
      if (!taskCountEl) return;
      const checkedCount = document.querySelectorAll('.interactive-task-item input:checked').length;
      taskCountEl.textContent = checkedCount;
    }

    checklistItems.forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (!checkbox) return;

      checkbox.addEventListener('change', () => {
        item.classList.toggle('completed', checkbox.checked);
        updateCompletedCount();
      });

      // Allow clicking the label text to toggle
      item.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          item.classList.toggle('completed', checkbox.checked);
          updateCompletedCount();
        }
      });
    });
  }

  // --- 4. Deployment Terminal Snippet Tabs ---
  function initTerminalTabs() {
    const tabs = document.querySelectorAll('.terminal-tab-btn');
    const panes = document.querySelectorAll('.terminal-pane');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        panes.forEach((p) => p.classList.toggle('active', p.id === targetId));
      });
    });
  }

  // --- 5. Clipboard Copy Functionality with Toast ---
  function showToast(message) {
    let toast = document.querySelector('.toast-notice');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast-notice';
      toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#20a878" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span class="toast-text"></span>`;
      document.body.appendChild(toast);
    }
    toast.querySelector('.toast-text').textContent = message || 'Copied to clipboard!';
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const textToCopy = btn.getAttribute('data-clipboard') ||
          btn.closest('.hero-command-box')?.querySelector('.hero-command-text')?.innerText?.replace(/^\$\s*/, '') ||
          btn.closest('.deploy-terminal-box')?.querySelector('.terminal-pane.active code')?.innerText;

        if (textToCopy) {
          try {
            await navigator.clipboard.writeText(textToCopy.trim());
            const origHTML = btn.innerHTML;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
            showToast('Copied command to clipboard!');
            setTimeout(() => {
              btn.innerHTML = origHTML;
            }, 2000);
          } catch (err) {
            console.error('Clipboard copy failed:', err);
            showToast('Copy failed. Please copy manually.');
          }
        }
      });
    });
  }

  // --- 6. FAQ Accordion ---
  function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach((item) => {
      const button = item.querySelector('.faq-question-btn');
      if (!button) return;

      button.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close others for clean accordion look
        faqItems.forEach((other) => {
          if (other !== item) {
            other.classList.remove('open');
            other.querySelector('.faq-question-btn')?.setAttribute('aria-expanded', 'false');
          }
        });

        item.classList.toggle('open', !isOpen);
        button.setAttribute('aria-expanded', (!isOpen).toString());
      });
    });
  }

  // --- 7. Mobile Navigation Drawer ---
  function initMobileMenu() {
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (!mobileBtn || !navLinks) return;

    mobileBtn.addEventListener('click', () => {
      const isOpen = navLinks.classList.contains('mobile-open');
      navLinks.classList.toggle('mobile-open', !isOpen);
      mobileBtn.setAttribute('aria-expanded', (!isOpen).toString());
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // --- 8. Fetch GitHub Repository Stars (with fallback) ---
  async function fetchGitHubStars() {
    const countEl = document.getElementById('github-star-count');
    if (!countEl) return;

    try {
      const res = await fetch('https://api.github.com/repos/volkanto/rook-lite', {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.stargazers_count === 'number') {
          countEl.textContent = data.stargazers_count.toLocaleString();
        }
      }
    } catch (e) {
      // Offline or rate-limited; fallback placeholder
      console.log('GitHub API offline or rate-limited, using fallback star count.');
    }
  }

  // Initialize all features on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMockupTabs();
    initMockupChecklist();
    initTerminalTabs();
    initCopyButtons();
    initFAQ();
    initMobileMenu();
    fetchGitHubStars();
  });
})();
