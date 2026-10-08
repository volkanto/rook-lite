# UI Simplification & Minimalist Interface Plan

## Objective
Transform Rook Lite into a refined, distraction-free, ultra-minimalist daily journal. Emphasize calm visual balance, editorial typography, progressive disclosure, and unified information architecture while eliminating redundant screens and CSS complexity.

---

## Key Files & Architectural Context
- **Shell & Navigation:** `src/main.ts`, `src/routing.ts`
- **Search & Actions:** `src/command-palette/commandPalette.ts`, `src/command-palette/commandRegistry.ts`
- **Views:** `src/main.ts` (`renderToday`, `renderTodos`, `renderSummariesV2`, `renderSettings`, `renderCategories`, `renderData`)
- **Stylesheets & Tokens:** `src/app.css`, `src/lite.css`, `rook-design-tokens.json`
- **Verification Suites:** `src/*.test.ts`, `src/command-palette/*.test.ts`

---

## Architectural Analysis & Current Friction Points

1. **Card Clutter & Lack of Progressive Disclosure:**
   - In the daily stream, every note card displays persistent Copy, Edit, and Delete buttons alongside category and tag badges. In a day with multiple notes, dozens of persistent action icons visually compete with writing and reading.
2. **Note Composer Toolbar Overkill:**
   - The editor card features 11 persistent formatting buttons (`B`, `I`, `• ≡`, `✓ ≡`, `<>`, Write, Preview, Zen, Category menu, Word count, Finish). In a Markdown-first app, this introduces unnecessary visual weight.
3. **Route Fragmentation & Duplicate Paradigms:**
   - **Search:** The Command Palette (`⌘K`) already provides fast fuzzy search, filter token syntax (`tag:`, `category:`, `has:todo`), recents, and action dispatch. The legacy `/search` route is orphaned and redundant.
   - **Data Portability:** `/data` (Markdown export, JSON backup/restore) is segregated into an orphaned route accessed via an icon button in Settings.
   - **Categories:** `/categories` is not exposed in primary navigation and is only reachable via Command Palette.
4. **Shell & Navigation Redundancy:**
   - The collapsed sidebar contains a redundant collapse toggle alongside the search button, theme toggle, and language picker popover.
5. **CSS Layering Debt:**
   - Over 11,700 lines of CSS across `app.css` and `lite.css`, containing 900 `!important` declarations that override styles rather than adhering to a single clean token architecture.

---

## Target Information Architecture (The 4 Core Views)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Rook Lite Application                           │
├─────────────────┬──────────────────────────────────────────────────────┤
│ 1. Journal (/)  │ Clean daily notes stream, minimal inline composer,   │
│                 │ progressive disclosure on hover/focus                │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 2. Tasks        │ Flat, serene checklist across all notes with muted   │
│    (/todos)     │ age metadata and instant toggle feedback             │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 3. Digest       │ Clean periodic digest (weekly/monthly/custom) without│
│    (/summaries) │ noisy disabled state controls                        │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 4. Settings     │ Unified settings hub: Appearance, Data Portability   │
│    (/settings)  │ (Export/Backup), Storage, and Categories             │
├─────────────────┴──────────────────────────────────────────────────────┤
│ Universal Hub: Command Palette (⌘K) for search, jumping, & shortcuts   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Phased Implementation Roadmap

### Phase 1: Note Stream Decluttering & Progressive Disclosure
- **Hover/Focus Action Reveal:** 
  - Hide `.note-quick-action-btn` (Copy, Edit, Delete) by default (`opacity: 0`, pointer-friendly hover transition).
  - Reveal actions smoothly on `:hover` or `:focus-within` of the note card.
  - On mobile/touch devices, keep actions accessible via tap or a subtle menu.
- **Streamlined Date Bar:**
  - Consolidate the header into a unified bar: `‹ Today, Oct 1 ›` with a clean calendar popover trigger.
  - Reduce visual duplication between the relative date badge and the "Today" button.
- **Card Hierarchy:**
  - Reduce border noise and card lift; let typography establish visual rhythm.

### Phase 2: Minimalist Writing Surface (Composer)
- **Ghost Writing Canvas:**
  - Collapse formatting buttons into a secondary trigger or rely on native Markdown formatting with subtle keyboard shortcut hints (`⌘Enter` to save, `⌘D` for zen mode).
  - Use a distraction-free textarea with an auto-expanding height and clean border framing.
- **Inline Metadata Row:**
  - Simplify category assignment and tag entry into an inline metadata strip.
  - Keep the footer unobtrusive (word count + save button).

### Phase 3: Route & Information Architecture Consolidation
- **Retire Orphaned `/search` Page:**
  - Re-route all search invocations (sidebar search button, keyboard shortcut `/` or `⌘K`, mobile search trigger) directly to `openSearch()`.
  - Remove legacy `/search` form markup and route handlers.
- **Absorb `/data` into `/settings`:**
  - Move "Markdown Export (Directory / ZIP)" and "JSON Backup & Restore" into a dedicated "Data & Portability" section in Settings.
  - Eliminate the standalone `/data` route while preserving all export and restore capabilities.
- **Sidebar & Chrome Cleanup:**
  - Retain 4 primary destinations: **Journal**, **Tasks**, **Summaries**, and **Settings**.
  - Remove the language popover from the sidebar footer rail; maintain language controls cleanly within Settings -> Appearance.
  - Simplify the sidebar collapse toggle to keep the icon rail clean and utilitarian.

### Phase 4: Polish Tasks (`/todos`) & Summaries (`/summaries`)
- **Tasks Ledger:**
  - Replace saturated age pills (`fresh`, `aging`, `stale`) with understated text chips (e.g. `today`, `2d`, `1w`).
  - Introduce subtle check transitions when tasks are marked complete.
  - Provide direct jump-to-note links with minimal visual weight.
- **Editorial Summaries:**
  - Hide disabled Ollama radio pills when Ollama is inactive; render a clean, distraction-free view.
  - Streamline date range selection into clean segmented tabs (`This Week`, `This Month`, `Custom`).
  - Present the summary as an editorial document rather than an analytics dashboard.

### Phase 5: CSS Consolidation & Token Alignment
- **Prune `!important` Overrides:**
  - Systematically eliminate the ~900 `!important` declarations in `src/lite.css`.
  - Consolidate layout rules into a single CSS hierarchy based on `rook-design-tokens.json`.
- **Enforce Minimalist Token System:**
  - Strict 1px hairline borders (`var(--color-border-subtle)`).
  - Subtle warm monochromatic backgrounds (`#F7F7FA` light, `#121214` dark).
  - Zero heavy drop shadows; replace with micro-elevation or flat borders.

---

## Verification & Testing Strategy

1. **Automated Unit & Integration Tests:**
   - Run Vitest suite (`npm test`) to ensure routing, command palette, note actions, backup/restore, and summary generation remain 100% green.
   - Update tests affected by navigation and routing changes (`navigation.test.ts`, `routing.test.ts`, `i18n.test.ts`).
2. **Interactive & Responsive Validation:**
   - Verify layout and interactions across desktop (> 960px), tablet (768px), and mobile (375px–480px).
   - Test full keyboard navigation: `⌘K` (search/commands), `⌘N` (new note), `⌘D` (zen mode), `ArrowLeft`/`ArrowRight` (date navigation), and `Esc` (dismiss modals).
3. **Accessibility & Contrast:**
   - Confirm WCAG AA contrast for text and interactive controls across both Light and Dark themes.
   - Verify all buttons and interactive controls retain descriptive `aria-label` and `aria-expanded` attributes.
