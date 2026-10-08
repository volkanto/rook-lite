# Rook Lite v2: Premium Utilitarian Redesign Plan

## 1. Objective & Vision
The goal is to elevate Rook Lite to a "v2" standard by adopting a **Premium Utilitarian Minimalism** aesthetic. Moving away from standard SaaS components, heavy borders, and deep shadows, the v2 UI will focus on an editorial, document-first reading experience. It takes inspiration from top-tier workspace platforms (like Reflect, Bear, and Notion).

## 2. Competitive Inspiration
*   **Bear 2:** Best-in-class typography and native-feeling markdown styling. Focus on disappearing UI when writing.
*   **Reflect Notes:** Utilitarian, high-contrast, keyboard-first navigation with beautifully subdued color palettes.
*   **Notion:** The pioneer of the `#F7F6F3` warm-bone background, high-contrast editorial typography, and bento-style macro-whitespace.

## 3. Core Aesthetic Constraints (The "Banned" List)
*   **NO generic typefaces:** Move away from Inter. Migrate to `Geist Sans`, `SF Pro Display`, or system-native elegant fonts.
*   **NO heavy shadows:** Strip out all `shadow-md`, `shadow-lg` etc. Replace with ultra-diffuse, low opacity shadows (e.g., `0 2px 8px rgba(0,0,0,0.04)`) or remove them entirely.
*   **NO bold primary colors:** The UI should be monochromatic. Colors are reserved exclusively for semantic states (pastels) or syntax highlighting.
*   **NO rounded pill containers:** Avoid `border-radius: 9999px` on large cards or sections. Keep borders crisp (e.g., 6px - 10px).

## 4. UI & Architectural Changes

### A. Color Palette (Warm Monochrome)
*   **Background (Light):** Pure White `#FFFFFF` or Warm Bone `#F7F6F3` for the application shell.
*   **Background (Dark):** Off-black `#111111` or `#191919`. Avoid pure black `#000000` for reading canvas to reduce eye strain.
*   **Text (Light Mode):** Charcoal `#2F3437` instead of harsh black.
*   **Borders:** Ultra-light gray `#EAEAEA` (`rgba(0,0,0,0.06)`). All cards, sidebars, and dividers will use exactly `1px solid var(--border)`.
*   **Accents:** Desaturated pastels for tags/badges (e.g., Pale Blue `#E1F3FE` with `#1F6C9F` text).

### B. Typography
*   **Primary (UI & Body):** `font-family: 'SF Pro Display', 'Geist Sans', -apple-system, sans-serif`.
*   **Editorial (Headings):** Introduce an editorial Serif for note titles (`font-family: 'Newsreader', 'Lyon Text', serif`) with tight letter-spacing (`-0.02em`).
*   **Monospace (Code & Tags):** `Geist Mono` or `SF Mono`.

### C. Layout & Structure
*   **Global Header:** Remove the heavy top bar. Integrate the search/command trigger into the top of the sidebar or as a floating, translucent pill in the top-center of the canvas.
*   **Sidebar:** Thinner, cleaner. Remove heavy active-state backgrounds. Use a subtle left-border highlight or a very faint gray background for the active note.
*   **Note Canvas:** Enforce a strict `max-w-3xl` center column. Increase macro-whitespace (e.g., `padding-top: 6rem`, `padding-bottom: 8rem`).
*   **Lists/Tasks:** Use crisp, custom SVG checkboxes. Add a subtle strikethrough animation when tasks are checked.

### D. Micro-Interactions
*   **Buttons:** Solid black (`#111111`) with white text. Hover state triggers a physical `transform: scale(0.98)` rather than a color shift.
*   **Scroll Entry:** Subtle fade-in (`translateY(10px)`) for lists of notes to make the app feel alive but not distracting.

## 5. Implementation Phases
**Phase 1: Token & CSS Refactoring**
*   Rewrite `src/app.css` and `src/lite.css` to strip out legacy standard SaaS tokens (the bright blue primary, thick borders, shadows).
*   Implement the new minimal color scales and typography variables.

**Phase 2: Layout Simplification**
*   Refactor `index.html` and `src/main.ts` layout structures.
*   Merge the global header into a cleaner sidebar/canvas split.
*   Implement a floating Command Palette design.

**Phase 3: Component Polish**
*   Update note cards, task lists, and markdown rendering (`src/markdown.ts`) to match the bento-box / editorial styling.
*   Update interactive elements (checkboxes, tags) to the new pastel/minimal spec.

## 6. Request for Approval
Please review this design direction. If you approve of the **Premium Utilitarian** aesthetic (warm monochromes, editorial typography, minimalist components), we can transition out of Plan Mode and begin Phase 1.