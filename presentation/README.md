# Rook Lite Presentation & Landing Page

A modern, static product landing page for **Rook Lite**, inspired by [usememos.com](https://usememos.com/) and styled with Rook's design token system.

## Highlights

- **Aesthetics & Architecture:** Clean, developer-centric, minimal design matching `usememos.com`.
- **Zero External Fonts or Tracking:** 100% compliant with Rook Lite's privacy model (uses system typography stacks; zero Google Fonts or third-party telemetry scripts).
- **Interactive App Showcase:**
  - Realistic browser window with macOS titlebar and simulated `rook-lite.local` address bar.
  - Interactive tabs: *Daily Notes & Tasks*, *Local Ollama AI Summaries*, and *Zero Lock-in Backups*.
  - Live interactive Markdown task checklist: check/uncheck tasks in real-time with dynamic progress counter updates.
- **Philosophy & Comparison:** "The Rook Lite Idea" contrasting SaaS cloud traps with local-first IndexedDB guarantees.
- **Bento Grid:** Highlights IndexedDB, dual-engine summarization, Markdown/DOMPurify sanitization, zero lock-in exports, and strict loopback security.
- **Copyable Terminal Commands:** 1-click Docker, npm, and static build snippets with animated toast notifications.
- **Light & Dark Themes:** Automatic system preference detection with manual toggle and localStorage persistence.
- **Mobile Responsive & Accessible:** Supports 375px through 1440px+ screens with full keyboard navigation and high-contrast color tokens.

## Files Structure

```text
presentation/
├── index.html        # Semantic HTML5 landing page structure
├── style.css         # Modern CSS with Rook Design Tokens & Dark/Light mode
├── script.js         # Vanilla JS interactivity (theme, tabs, checklist, copy, FAQ)
├── README.md         # Documentation
└── assets/
    ├── logo.png      # Application icon
    ├── banner.png    # Hero artwork & banner
    └── empty-notes.png
```

## Previewing the Page

You can open `presentation/index.html` directly in any web browser:

```bash
# macOS
open presentation/index.html

# Linux
xdg-open presentation/index.html

# Or serve locally with any static server:
npx serve presentation
# or
python3 -m http.server 3000 --directory presentation
```
