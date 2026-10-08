# Modern UI Modernization Plan for Rook Lite

## 1. Executive Summary & Note-Taking Benchmark

Leading modern note-taking applications (**Bear 2**, **Apple Notes**, **Notion**, **Reflect**, **Craft**, and **Obsidian**) share core design principles that make them feel fast, calm, and delightful:

| Dimension | Legacy / Current Rook Lite Friction | Modern Benchmark (Bear, Reflect, Apple Notes, Craft) |
| :--- | :--- | :--- |
| **Visual Architecture** | Heavy card borders, stacked boxes, card lift shadows | **Fluid editorial canvas**: Clean hairline dividers, pure whitespace, and paper-like breathing room |
| **Action Density** | Persistent Copy, Edit, and Delete buttons on every note card create visual noise | **Progressive disclosure**: Action clusters reveal smoothly on hover/focus (`opacity: 0 → 1`), keeping the stream serene |
| **Composer** | Rigid 11-button formatting toolbar always taking up visual weight | **Inviting, quiet writing surface**: Minimalist canvas with auto-expanding height, slash/keyboard shortcuts (`⌘B`, `⌘I`, `⌘K`), and docked floating pill formatting |
| **Tasks (`/todos`)** | Standard checkboxes in plain lists | **Things 3 / Apple Reminders tactile checklists**: Crisp circular checks, strike-through animation, and muted age badges |
| **Navigation & Shell** | Dual calendars, duplicate search route, competing CSS classes | **Integrated navigation rail**: Collapsible sidebar, unified calendar popover, floating Command Palette (`⌘K`) |
| **CSS Architecture** | ~11,500 lines across `app.css` & `lite.css` with 900+ `!important` flags | **Token-driven CSS hierarchy**: Direct binding to `rook-design-tokens.json` with zero override debt |

> **Core Modernization Rule:** Elevate the writing and reading experience to 2026 standards **without removing, degrading, or restructuring any existing feature**.

---

## 2. Design System & Visual Foundation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Modern Design Tokens                                  │
├─────────────────────┬───────────────────────────────────────────────────────────┤
│ Canvas & Surfaces   │ Light: Canvas #F7F7FA, Surface #FFFFFF, Sunken #F0F2F5    │
│                     │ Dark:  Canvas #121214, Surface #18181B, Sunken #0F0F11    │
├─────────────────────┼───────────────────────────────────────────────────────────┤
│ Hairline Borders    │ 1px solid var(--border-subtle) (Light: #E5E7EB, Dark: #26262B) │
│ Micro-Elevations    │ Flat hairlines by default; 0 2px 8px rgba(0,0,0,0.04) on popups│
├─────────────────────┼───────────────────────────────────────────────────────────┤
│ Editorial Type      │ -apple-system, BlinkMacSystemFont, "SF Pro Text", "Geist",│
│                     │ "Inter", sans-serif. Line-height 1.6, measure 68ch        │
├─────────────────────┼───────────────────────────────────────────────────────────┤
│ Accent & Signals    │ Brand: #5B5BD6 (Light) / #7C7CF8 (Dark)                   │
│                     │ Success: #2F9E74, Amber: #D4A72C, Danger: #E25555         │
└─────────────────────┴───────────────────────────────────────────────────────────┘
```

### Typography & Spacing Rhythm
- **Reading Measure:** Fixed maximum reading width of `52rem` (68ch) centered on wide displays, preventing strain during long-form reading.
- **Rhythm Scale:** 4px baseline grid (`--sp-1: 4px`, `--sp-2: 8px`, `--sp-3: 12px`, `--sp-4: 16px`, `--sp-6: 24px`, `--sp-8: 32px`).
- **Typography Scale:** Body at 15px/16px (1rem) with a 1.65 line height; Headings using refined weights (H1: 1.45rem w/ -0.025em letter spacing, H2: 1.3rem, H3: 1.1rem).

---

## 3. Screen-by-Screen Modernization Blueprint

### 3.1. App Shell & Navigation
- **Collapsible Sidebar:**
  - Modern icon rail when collapsed (56px width) with floating tooltip labels.
  - Active route indicated with a soft pill indicator (`var(--accent-soft)`) and 2px brand indicator line.
  - Quick action buttons (Command Palette trigger, Theme toggle, Language switch) clustered neatly at the bottom.
  - Clean slide-over drawer on mobile viewports (< 768px) with a translucent backdrop blur (`backdrop-filter: blur(8px)`).
- **Consolidated Calendar:**
  - Retire the redundant static sidebar calendar grid. Retain the **rich interactive calendar popover** in the date header, showing note density dots, ISO week numbers, and weekly totals.

### 3.2. Journal & Daily Notes Stream (`/`)
- **Streamlined Date Header Bar:**
  - Consolidate navigation into a unified floating bar: `‹ Date Title ›`, `Today` jump pill, and the `[ 📅 ]` calendar trigger.
  - Clean relative date pill (`Today`, `Yesterday`, `3d ago`) with subtle styling.
- **Minimalist Writing Canvas (Composer):**
  - **Ghost Canvas:** Clean, distraction-free container that expands organically as you type.
  - **Contextual Formatting Bar:** Toolbar buttons grouped into a compact bottom or floating pill toolbar, displaying keyboard hints (`⌘B`, `⌘I`, `⌘Enter` to save).
  - **Inline Template & Tag Autocomplete:** Retain instant `#tag` autocomplete popup and `[[` wikilink picker with modern floating menu styles.
  - **Word Count & Auto-Draft:** Auto-saves drafts quietly to IndexedDB without UI flashing.
  - **Zen Mode (`⌘D`):** Seamless full-screen transition with centered focus writing area.
- **Note Stream & Progressive Disclosure:**
  - **Cardless / Hairline Layout:** Notes breathe naturally without heavy boxes; separated by subtle hairlines or soft surface separation.
  - **Hover / Focus Action Reveals:** The Copy, Edit, and Delete action buttons remain invisible or faint until the card is hovered or focused via keyboard (`opacity: 0 → 1` with a 150ms transition). On touch devices, actions remain accessible via tap.
  - **Interactive Checkboxes:** Clicking a markdown checkbox `- [ ]` provides immediate tactile feedback: checkmark bounce, strikethrough transition on text, and instant IndexedDB update without reloading the page.
  - **Backlinks & Tags:** Clean `#tag` pill chips and an understated backlink drawer with date badges and context snippets.

### 3.3. Tasks Hub (`/todos`)
- **Visual Style:** Inspired by Things 3 and Apple Reminders.
- **Segmented Grouping Tabs:** Clean pill switchers: `By Date` | `By Tag` | `All Tasks`.
- **Task Cards:**
  - Crisp circular checkbox hit target (min 44×44px touch area).
  - Inline markdown rendering for task labels.
  - Muted relative age chips (`today`, `2d`, `1w`).
  - Source note link (`Jump to note`) with an understated arrow icon.
  - **Completion Animation:** Checking a task triggers an instantaneous strikethrough, dimming to 40% opacity, and a smooth collapse transition before saving.

### 3.4. Summaries Hub (`/summaries`)
- **Editorial Report Layout:** Present summaries as a refined reading document rather than an analytics dashboard.
- **Segmented Period Switcher:** Simple segmented tabs for `This Week` | `This Month` | `Custom Range`.
- **Engine Status Pill:** Elegant badge indicating engine status (`Rule-based (Offline)` or `Ollama (Local LLM)`).
- **Split/Inline Refinement:** Summary markdown displays formatted prose by default, with an expandable "Edit" drawer for personal polishing.
- **Action Toolbar:** Quick `Copy to Clipboard`, `Export .md`, and `Regenerate` buttons in a discreet top-right action cluster.

### 3.5. Settings Hub (`/settings`)
- **Apple/Linear Grouped Bento Sections:**
  - Grouped cards with rounded corners (`12px`) and subtle borders.
  - **Appearance Section:** Segmented buttons for `System` | `Light` | `Dark`, and language buttons for `English` | `Türkçe`.
  - **Local AI (Ollama) Section:** Clean toggle switch, endpoint input, auto-populated model selector, temperature slider, and connection test indicator.
  - **Data & Portability Section:** Storage usage meter, and distinct action buttons for `Export Markdown (ZIP)`, `Export to Directory`, `Download JSON Backup`, and `Restore Backup`.
  - **Danger Zone:** Understated "Clear All Data" button with double-confirmation dialog.

### 3.6. Universal Command Palette (`⌘K`)
- **Spotlight / Raycast-Style Modal:** Centered floating dialog with backdrop blur.
- **Quick Filters:** Pre-populated token chips (`tag:`, `has:todo`, `date:`).
- **Visual Hierarchy:** Grouped into `Recents`, `Notes`, `Dates`, and `Commands` with keyboard navigation badges (`↑↓ to navigate`, `↵ to select`, `esc to close`).

---

## 4. Comprehensive Feature Parity Matrix

Every single capability of Rook Lite is preserved:

| Feature Area | Existing Feature | Modernized State | Parity Status |
| :--- | :--- | :--- | :---: |
| **Journaling** | Daily timeline (`/?date=...`) | Sleek date header + fluid stream | ✅ 100% Preserved |
| **Date Hopping** | Prev/Next day, Today button | Unified navigation bar + shortcuts (`←`/`→`) | ✅ 100% Preserved |
| **Calendar** | Density dots, week numbers, totals | Preserved inside `#notes-calendar` popover | ✅ 100% Preserved |
| **Composer** | Markdown toolbar (11 buttons) | Docked/floating pill toolbar with shortcuts | ✅ 100% Preserved |
| **Templates** | Predefined templates menu | Preserved with dropdown menu | ✅ 100% Preserved |
| **Preview** | Write vs Preview mode | Segmented tab switcher | ✅ 100% Preserved |
| **Zen Mode** | Fullscreen writing canvas (`⌘D`) | Smooth expanding distraction-free view | ✅ 100% Preserved |
| **Autosave** | Draft persistence per day in IndexedDB | Unobtrusive auto-save indicator | ✅ 100% Preserved |
| **Autocompletes** | `#tag` and `[[wikilink]]` candidate menus | Floating candidate popovers | ✅ 100% Preserved |
| **Note Items** | Timestamp, markdown prose, code hl | Typography-first rendering, syntax hl | ✅ 100% Preserved |
| **Interactive Tasks** | Direct checkbox toggles in notes | Smooth checkmark & strike animation | ✅ 100% Preserved |
| **Backlinks** | Note & Day backlinks with snippets | Understated collapsible backlink pills | ✅ 100% Preserved |
| **Note Actions** | Copy markdown, Edit modal, Delete note | Progressive disclosure on hover/focus | ✅ 100% Preserved |
| **Tasks Hub** | Grouping by Date, Tag, or All | Things 3 checklist with instant filters | ✅ 100% Preserved |
| **Summaries** | Week/Month/Custom, Rule & Ollama | Editorial report with instant generation | ✅ 100% Preserved |
| **Settings** | Themes, i18n, Ollama setup, Backups | Bento-style settings cards | ✅ 100% Preserved |
| **Data Portability** | ZIP export, Directory API, JSON backup | 1-click action triggers in Settings | ✅ 100% Preserved |
| **Search / ⌘K** | Command palette with filter tokens | Raycast/Spotlight-style floating palette | ✅ 100% Preserved |
| **PWA & Offline** | Service worker, IndexedDB storage | Local-first and offline-ready | ✅ 100% Preserved |
