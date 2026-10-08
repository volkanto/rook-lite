# Plan: Prevent Blank Note Creation

## Objective
Prevent users from creating blank notes when the editor contains no text, and handle the case where an existing note is cleared during editing by prompting for deletion.

## Scope
- Modify the editor HTML markup to support disabling the submit button.
- Update the `bindCreateEditor` and `showEditDialog` logic in `src/main.ts` to manage the submit button's disabled state based on textarea content.
- Introduce logic to prompt for deletion if an existing note's content is cleared completely.

## Implementation Steps

### 1. Update Editor Markup
- **File:** `src/main.ts`
- **Action:** Modify the `editorMarkup` function. The submit button is currently rendered as:
  ```html
  <button type="submit" class="save-btn-rect icon-action-btn" title="${label}" aria-label="${label}">${svg(icons.check, "btn-action-icon")}<span class="visually-hidden">${label}</span></button>
  ```
- **Change:** Add the `disabled` attribute to this button by default. We will rely on JavaScript to enable it when content is present.

### 2. Update New Note Editor Logic (`bindCreateEditor`)
- **File:** `src/main.ts`
- **Action:** In `bindCreateEditor`, find the submit button and update its disabled state based on the textarea's content.
- **Change:** 
  - Add a reference to the submit button: `const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");`
  - Inside `updateComposer`, calculate `hasText` (which is already `Boolean(textarea.value.trim())`). Use this to set `submitBtn.disabled = !hasText;`.
  - Since `updateComposer` is called on initialization, focus, and input, this will keep the button state synced.
  - Remove the early return `if (!textarea.value.trim()) return;` in the submit handler, as the button will be disabled anyway, but it's good practice to keep it as a fallback. (Wait, if the user hits Cmd+Enter, we need that check). Let's keep the check `if (!textarea.value.trim()) return;` in the submit handler, and also add it to the keydown handler for Cmd+Enter.

### 3. Update Edit Dialog Logic (`showEditDialog`)
- **File:** `src/main.ts`
- **Action:** In `showEditDialog`, manage the submit button state and handle the clear-all scenario.
- **Change:**
  - Add a reference to the submit button: `const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");`
  - Create a helper function `updateSubmitButton()` that sets `submitBtn.disabled = !textarea.value.trim();`. Call this on init and inside the `input` event listener.
  - Update the submit handler (`form.addEventListener("submit", async (event) => ...`):
    - If `!textarea.value.trim()`, it means the user cleared the text.
    - Instead of returning early or saving an empty note, trigger the delete confirmation. We can reuse the existing `deleteNote` logic or show a confirm dialog.
    - Example:
      ```javascript
      if (!textarea.value.trim()) {
        const s = currentStrings();
        if (window.confirm(s.confirmDeleteNote ?? "Are you sure you want to delete this note?")) {
           await notes.delete(note.id);
           closeDialog();
           await renderRoute();
        }
        return;
      }
      ```
    - *Self-correction:* We need to check if `confirmDeleteNote` exists in `s`. Let's check `i18n.types.ts`. It seems there is a `confirmDeleteNote` or similar. Let's research this.

### 4. Internationalization (i18n) verification
- Check `src/i18n.types.ts`, `src/locales/en.ts`, and `src/locales/tr.ts` to ensure we have an appropriate string for the delete confirmation, or add one if necessary.

## Verification
- Open the app, focus the new note input. The save button should be disabled.
- Type text. The save button should enable.
- Clear text. The save button should disable.
- Press Cmd+Enter with empty text. Nothing should happen.
- Edit an existing note. The save button should be enabled.
- Clear all text. The save button should become disabled. Wait, if it becomes disabled, they can't click it to trigger the delete prompt! 
  - *Correction on Approach:* If we disable the button when empty, they can never click "Save" to trigger the delete prompt. We have two options for the edit dialog:
    1. Keep button enabled if empty, and show the prompt on click.
    2. Disable button if empty. To delete, they must use the actual trash icon in the header (which already exists).
  - *Re-evaluation:* If they clear the text and want to delete, clicking the explicit trash icon is better UX than clicking "Save" to delete. Let's just disable the save button if the textarea is empty, matching the New Note behavior.

*Revised Step 3:* Just disable the submit button in `showEditDialog` when the textarea is empty. If they want to delete, they can close the dialog (leaving the note unchanged) and click the delete button on the note itself. Or, we can ensure the delete button is available inside the edit modal? The edit modal currently has a close button. Let's just stick to disabling the save button.

Let's refine the plan based on this realization.