# Radical Restructure: Mac-Style 3-Pane UI Plan

## Objective
Discard the current single-column daily stream layout and implement a radical structural shift: a **Mac-style 3-pane interface** (Sidebar | Note List | Editor). This structural overhaul will dramatically change how the user interacts with the app while preserving all existing functionality.

## 1. Structural Paradigm Shift

Currently, Rook Lite renders a "Daily Stream" where notes are stacked vertically on top of each other, and the composer is inserted inline at the top of the stream.

**The New Structure (CSS Grid):**
```
+-------------+------------------+--------------------------------------+
|             |                  |                                      |
| Sidebar     | Notes List       | Note Editor / Reader                 |
| (Nav)       | (Master)         | (Detail)                             |
| 16rem wide  | 20rem wide       | Remaining flexible space             |
|             |                  |                                      |
| - Search    | - List of notes  | - Large, focused reading/writing     |
| - Today     | - Snippets       |   canvas                             |
| - Tasks     | - Date headers   | - Always visible when a note is      |
| - Summaries | - Scrollable Y   |   selected                           |
|             |                  |                                      |
+-------------+------------------+--------------------------------------+
```

## 2. Core Architectural Changes (`src/main.ts`)

To achieve this, we must completely decouple the "List" from the "Editor".

### A. Routing & State Management
- Currently, navigating to `/` (or `/?date=X`) renders the entire day's stream.
- **New Behavior:** 
  - `/?date=X`: Updates the Middle Pane (Note List) to show notes for that day. It will default to selecting the first note or opening an empty composer in the Right Pane.
  - `/?date=X&note=Y`: Explicitly loads Note Y into the Right Pane (Editor/Reader).
- **DOM Structure Update:**
  - Replace the single `.shell` container with a `.workspace-grid` container.
  - The workspace grid will hold `<aside class="list-pane">` and `<main class="editor-pane">`.

### B. The Middle Pane (Note List)
- **Role:** Replaces the full `.day-notes` section.
- **Content:** Will render compact "Cards" showing the Note Title, Time, and a 2-line snippet of the markdown.
- **Interaction:** Clicking a card does *not* expand it inline. It pushes the full content into the Right Pane.

### C. The Right Pane (Editor/Reader)
- **Role:** A persistent, distraction-free canvas for reading and writing.
- **Behavior:** 
  - If no note is selected, it acts as a "New Note" composer (the Ghost Composer).
  - If a note is selected, it renders the rich Markdown preview.
  - The "Edit" button flips this pane from Preview mode to Write mode.
- **Header:** The date controls (Calendar, Prev/Next day) move to the top of this pane or the top of the Middle Pane.

### D. Preserving Features
- **Todos View (`/todos`):** The middle pane shows the list of tasks. Clicking a task opens the associated note in the right pane.
- **Summaries View (`/summaries`):** Middle pane shows available summary periods. Right pane shows the generated editorial summary.
- **Settings (`/settings`):** The middle pane shows Settings categories (Appearance, Data). Right pane shows the actual toggles.

## 3. CSS Architecture (`src/app.css` & `src/lite.css`)

- **Layout:** Implement `display: grid` on `.app` or `.main-layout` with `grid-template-columns: 240px 320px 1fr;` (on desktop).
- **Responsive (Mobile):** 
  - On screens < 768px, the layout becomes a stack: The Note List is visible by default. Clicking a note pushes a new view (the Editor) over the screen (standard mobile drill-down).
- **Visuals:** We will apply the minimalist tokens (Warm monochrome, pure hairlines, no heavy box shadows) to this new grid, creating a very flat, sleek interface reminiscent of Bear 2 or Apple Notes.

## 4. Implementation Steps

1. **DOM Refactor (`main.ts`):** Rewrite `renderToday()` to split generation into `renderListPane()` and `renderEditorPane()`.
2. **State Management:** Introduce a lightweight active note state (`activeNoteId`) to govern what is shown in the right pane without full page reloads.
3. **CSS Grid (`app.css`):** Tear out the max-width centered column layout and replace it with the `100vw` / `100vh` locked 3-pane grid.
4. **Mobile Navigation:** Implement a back button in the Editor pane when on mobile to return to the list pane.
5. **Component Polish:** Style the new compact list cards and the full-height editor canvas.

## 5. Approval Request

This plan outlines a **structural teardown** of the current layout to implement the 3-pane Mac-style interface. 

Are you aligned with this 3-pane Master/Detail structure? If approved, I will exit Plan Mode and begin rewriting `main.ts` and `app.css` to build this new architecture.