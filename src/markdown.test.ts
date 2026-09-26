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

describe("markdown code blocks and syntax highlighting", () => {
  it("highlights Java code blocks with hljs classes and copy button", () => {
    const markdown = '```java\npublic class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}\n```';
    const html = renderMarkdown(markdown);

    expect(html).toContain('class="code-block-wrapper"');
    expect(html).toContain('class="code-block-header"');
    expect(html).toContain('<span class="code-block-lang">java</span>');
    expect(html).toContain('class="copy-code-btn"');
    expect(html).toContain('<span class="copy-code-text">Copy</span>');
    expect(html).toContain('class="hljs language-java"');
    expect(html).toContain('class="hljs-keyword">public</span>');
    expect(html).toContain('class="hljs-title class_">HelloWorld</span>');
  });

  it("normalizes and highlights shell code blocks (including 'shel' abbreviation)", () => {
    const markdown = '```shel\ncurl -fsSL https://example.com | bash\necho "done"\n```';
    const html = renderMarkdown(markdown);

    expect(html).toContain('class="code-block-wrapper"');
    expect(html).toContain('<span class="code-block-lang">shell</span>');
    expect(html).toContain('class="copy-code-btn"');
    expect(html).toContain('class="hljs language-shell"');
  });

  it("handles raw code blocks without language and falls back gracefully", () => {
    const markdown = '```\nplain text code block\nwithout syntax highlighting\n```';
    const html = renderMarkdown(markdown);

    expect(html).toContain('class="code-block-wrapper"');
    expect(html).toContain('class="copy-code-btn"');
    expect(html).toContain('class="hljs raw-code"');
    expect(html).toContain("plain text code block");
  });

  it("extracts plainText without polluting with code block copy button or language headers", async () => {
    const { plainText } = await import("./markdown");
    const markdown = 'My note description:\n```java\nint count = 10;\n```\nFollow up text.';
    const text = plainText(markdown);

    expect(text).not.toContain("Copy");
    expect(text).toContain("My note description:");
    expect(text).toContain("int count = 10;");
    expect(text).toContain("Follow up text.");
  });
});
