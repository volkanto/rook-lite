# macOS Native App Implementation Plan

## Objective
Develop a fully native, local-first macOS desktop application for Rook Lite using SwiftUI and SwiftData, replacing the web-based IndexedDB architecture with a native desktop experience.

## Key Files & Context
- **Target Directory:** `macos/`
- **Architecture:** MVVM + SwiftData
- **UI Framework:** SwiftUI
- **Database:** SwiftData
- **AI Integration:** Local Ollama via `URLSession`

## Scope & Impact
- **Models:** Re-implement Notes, Categories, Drafts, and Summaries as `@Model` SwiftData classes.
- **UI/UX:** Desktop-optimized layout utilizing `NavigationSplitView` (Sidebar for categories/navigation, Content for note lists, Detail for the Markdown editor).
- **Markdown:** Integrate a Swift-native markdown renderer (e.g., `MarkdownUI`) for previewing, and a robust `TextEditor` for editing.
- **AI Connectivity:** Implement a native network client to query local Ollama (`http://localhost:11434`) without requiring an external server.

## Implementation Steps

### Phase 1: Project Setup & SwiftData Models
1. Create a new Xcode macOS project in the `macos/` directory.
2. Define SwiftData `@Model` entities to mirror the current IndexedDB schema:
   - `Note`: id, title, content, categoryId, createdAt, updatedAt
   - `Category`: id, name, color
   - `Draft`: id, noteId, content, savedAt
   - `Summary`: id, categoryId, content, generatedAt, type (rule-based vs AI)
3. Configure the `ModelContainer` for local, persistent storage.

### Phase 2: User Interface & Navigation
1. Build the main application structure using `NavigationSplitView`.
2. Implement the Sidebar to list categories and smart folders (All Notes, Recent, Drafts).
3. Implement the Note List view with sorting and filtering capabilities.
4. Implement the Note Editor view featuring a side-by-side or toggleable Markdown preview.
5. Add macOS-specific enhancements: native menu bar commands, keyboard shortcuts, and window management.

### Phase 3: AI Integration & Business Logic
1. Implement an `OllamaService` using `URLSession` to handle asynchronous summarization requests to the local Ollama instance.
2. Configure App Sandbox entitlements (`com.apple.security.network.client`) to allow outbound connections to localhost.
3. Replicate the rule-based local summarization logic natively in Swift.

### Phase 4: Import, Export & Polish
1. Implement native file export capabilities (JSON/Markdown ZIP) using macOS `NSSavePanel`.
2. Implement Dark/Light mode support natively utilizing SwiftUI color hierarchies.
3. Add search functionality via `.searchable` modifier tied to SwiftData queries.

## Verification & Testing
- Unit tests for the SwiftData model migrations and CRUD operations.
- Verify App Sandbox permissions correctly allow localhost Ollama connectivity.
- UI tests for the NavigationSplitView behaviors on different window sizes.

## Migration & Rollback
- The web application remains untouched in the root directory. This is a parallel native client.
- Users can export JSON from the web app; the macOS app should include an import feature to parse this JSON and populate SwiftData.