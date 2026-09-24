import DOMPurify from "dompurify";
import { marked } from "marked";

marked.use({ gfm: true, breaks: false });

function sanitizeHtml(html: string): string {
  const purify = typeof (DOMPurify as any).sanitize === "function"
    ? (DOMPurify as any)
    : typeof DOMPurify === "function" && typeof window !== "undefined"
      ? (DOMPurify as any)(window)
      : ((DOMPurify as any).default ?? DOMPurify);

  return purify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "iframe", "object", "embed"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["data-task-index"]
  });
}

export function renderMarkdown(markdown: string, interactive = false): string {
  const rendered = marked.parse(markdown, { async: false }) as string;
  const sanitized = sanitizeHtml(rendered);

  if (!interactive) {
    return sanitized;
  }

  let taskIndex = 0;
  let processed = sanitized.replace(
    /<li(\b[^>]*?)>\s*(<input\b[^>]*?type=["']checkbox["'][^>]*?>)\s*([\s\S]*?)<\/li>/gi,
    (_, liAttrs, checkboxMatch, content) => {
      const isChecked = /\bchecked\b/i.test(checkboxMatch);
      const index = taskIndex++;
      const hasClass = /class=["']/i.test(liAttrs);
      const updatedLiAttrs = hasClass
        ? liAttrs.replace(/class=["']([^"']*)["']/i, 'class="$1 task-list-item"')
        : ` class="task-list-item"${liAttrs}`;
      return `<li${updatedLiAttrs}><input type="checkbox" class="interactive-task-checkbox" data-task-index="${index}" ${isChecked ? "checked" : ""}><span class="task-item-content">${content.trim()}</span></li>`;
    }
  );

  processed = processed.replace(/<input\b[^>]*?type=["']checkbox["'][^>]*?>/gi, (match) => {
    if (match.includes("interactive-task-checkbox")) return match;
    const isChecked = /\bchecked\b/i.test(match);
    const index = taskIndex++;
    return `<input type="checkbox" class="interactive-task-checkbox" data-task-index="${index}" ${isChecked ? "checked" : ""}>`;
  });

  return processed;
}

export function toggleTaskInMarkdown(markdown: string, targetIndex: number): string {
  let currentIndex = 0;
  const lines = markdown.split(/\r?\n/);
  const updatedLines = lines.map((line) => {
    const taskMatch = line.match(/^(\s*[-*+]\s+\[)([ xX])(\]\s*.*)$/);
    if (taskMatch) {
      if (currentIndex === targetIndex) {
        const isChecked = taskMatch[2].toLowerCase() === "x";
        const newMark = isChecked ? " " : "x";
        currentIndex += 1;
        return `${taskMatch[1]}${newMark}${taskMatch[3]}`;
      }
      currentIndex += 1;
    }
    return line;
  });
  return updatedLines.join("\n");
}

export function plainText(markdown: string): string {
  const container = document.createElement("div");
  container.innerHTML = renderMarkdown(markdown);
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function deriveTitle(markdown: string): string | null {
  const heading = markdown.split(/\r?\n/).map((line) => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim()).find(Boolean);
  if (heading) return heading.slice(0, 160);
  const firstLine = markdown.split(/\r?\n/).map((line) => line.replace(/^[-*+>]\s*/, "").trim()).find(Boolean);
  return firstLine ? firstLine.replace(/[*_~`#[\]]/g, "").trim().slice(0, 160) || null : null;
}

export function extractTags(markdown: string): string[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```|`[^`]*`|^#{1,6}\s.*$/gm, "");
  const tags = new Set<string>();
  for (const match of withoutCode.matchAll(/(^|[\s(])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,38})/gu)) {
    tags.add(match[2].toLocaleLowerCase("und"));
  }
  return [...tags];
}

export function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}
