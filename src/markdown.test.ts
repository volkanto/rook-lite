// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderMarkdown, toggleTaskInMarkdown } from "./markdown";

describe("markdown task toggling and interactive checkboxes", () => {
  it("toggles unchecked task to checked", () => {
    const original = "- [ ] First task\n- [ ] Second task";
    const toggled = toggleTaskInMarkdown(original, 0);
    expect(toggled).toBe("- [x] First task\n- [ ] Second task");
  });

  it("toggles checked task back to unchecked", () => {
    const original = "- [x] Done item\n- [ ] Pending item";
    const toggled = toggleTaskInMarkdown(original, 0);
    expect(toggled).toBe("- [ ] Done item\n- [ ] Pending item");
  });

  it("toggles specific task index in multi-item lists", () => {
    const original = "Notes for today:\n- [ ] Task A\n- [ ] Task B\n- [ ] Task C";
    const toggled = toggleTaskInMarkdown(original, 1);
    expect(toggled).toBe("Notes for today:\n- [ ] Task A\n- [x] Task B\n- [ ] Task C");
  });

  it("renders non-disabled interactive checkboxes with sequential task indices", () => {
    const markdown = "- [ ] Buy milk\n- [x] Walk dog";
    const html = renderMarkdown(markdown, true);

    expect(html).toContain('class="interactive-task-checkbox"');
    expect(html).toContain('data-task-index="0"');
    expect(html).toContain('data-task-index="1"');
    expect(html).toContain("checked");
    expect(html).not.toContain("disabled");
  });

  it("wraps task text in task-item-content for animated strikethrough", () => {
    const markdown = "- [ ] Finish presentation";
    const html = renderMarkdown(markdown, true);
    expect(html).toContain('<span class="task-item-content">Finish presentation</span>');
  });

  it("renders standard disabled checkboxes when interactive is false", () => {
    const markdown = "- [ ] Static item";
    const html = renderMarkdown(markdown, false);

    expect(html).toContain("disabled");
    expect(html).not.toContain("interactive-task-checkbox");
  });
});
