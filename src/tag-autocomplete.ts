export interface AutocompleteMatch {
  query: string;
  startIndex: number;
  endIndex: number;
}

export function getAutocompleteQuery(text: string, cursorIndex: number): AutocompleteMatch | null {
  const beforeCursor = text.slice(0, cursorIndex);
  const match = beforeCursor.match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);
  if (!match) return null;

  const rawMatch = match[0];
  const query = match[1];
  const hashOffset = rawMatch.lastIndexOf("#");
  const startIndex = (match.index ?? 0) + hashOffset;
  const endIndex = cursorIndex;

  return { query, startIndex, endIndex };
}

export function filterMatchingTags(allTags: Array<[string, number]>, query: string): Array<[string, number]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return allTags.slice(0, 6);
  }
  return allTags
    .filter(([tag]) => tag.toLowerCase().includes(normalized))
    .slice(0, 8);
}

export function insertTagAtCursor(
  text: string,
  tag: string,
  startIndex: number,
  endIndex: number
): { text: string; newCursor: number } {
  const replacement = `#${tag} `;
  const updatedText = text.slice(0, startIndex) + replacement + text.slice(endIndex);
  const newCursor = startIndex + replacement.length;
  return { text: updatedText, newCursor };
}

export function attachTagAutocomplete(
  textarea: HTMLTextAreaElement,
  getTags: () => Promise<Array<[string, number]>>
): () => void {
  const container = textarea.parentElement;
  if (!container) return () => {};

  const dropdown = document.createElement("div");
  dropdown.className = "tag-autocomplete-dropdown";
  dropdown.setAttribute("role", "listbox");
  dropdown.setAttribute("aria-label", "Tag suggestions");
  dropdown.style.display = "none";
  container.appendChild(dropdown);

  let currentMatch: AutocompleteMatch | null = null;
  let matchingTags: Array<[string, number]> = [];
  let selectedIndex = 0;

  function hideDropdown(): void {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    currentMatch = null;
    matchingTags = [];
    selectedIndex = 0;
  }

  function renderSuggestions(): void {
    if (matchingTags.length === 0) {
      hideDropdown();
      return;
    }
    dropdown.innerHTML = "";
    matchingTags.forEach(([tag, count], index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `tag-autocomplete-item ${index === selectedIndex ? "is-selected" : ""}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
      item.innerHTML = `<span class="tag-autocomplete-tag-name">#${tag}</span><span class="tag-autocomplete-count">${count}</span>`;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectTag(tag);
      });
      dropdown.appendChild(item);
    });
    dropdown.style.display = "block";
  }

  function selectTag(tag: string): void {
    if (!currentMatch) return;
    const { text, newCursor } = insertTagAtCursor(
      textarea.value,
      tag,
      currentMatch.startIndex,
      currentMatch.endIndex
    );
    textarea.value = text;
    textarea.setSelectionRange(newCursor, newCursor);
    hideDropdown();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  async function updateAutocomplete(): Promise<void> {
    const cursor = textarea.selectionStart ?? 0;
    const match = getAutocompleteQuery(textarea.value, cursor);
    if (!match) {
      hideDropdown();
      return;
    }

    currentMatch = match;
    const allTags = await getTags();
    matchingTags = filterMatchingTags(allTags, match.query);
    selectedIndex = 0;
    renderSuggestions();
  }

  function handleInput(): void {
    void updateAutocomplete();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (dropdown.style.display === "none" || matchingTags.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % matchingTags.length;
      renderSuggestions();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = (selectedIndex - 1 + matchingTags.length) % matchingTags.length;
      renderSuggestions();
    } else if (event.key === "Enter" || event.key === "Tab") {
      if (matchingTags[selectedIndex]) {
        event.preventDefault();
        selectTag(matchingTags[selectedIndex][0]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      hideDropdown();
    }
  }

  function handleBlur(): void {
    window.setTimeout(() => hideDropdown(), 150);
  }

  textarea.addEventListener("input", handleInput);
  textarea.addEventListener("keydown", handleKeydown);
  textarea.addEventListener("blur", handleBlur);

  return () => {
    textarea.removeEventListener("input", handleInput);
    textarea.removeEventListener("keydown", handleKeydown);
    textarea.removeEventListener("blur", handleBlur);
    dropdown.remove();
  };
}
