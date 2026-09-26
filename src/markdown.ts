import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { marked } from "marked";

const COPY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="copy-code-svg" aria-hidden="true"><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/></svg>';

function normalizeLanguage(lang: string | undefined): string | null {
  if (!lang) return null;
  const clean = lang.trim().toLowerCase();
  if (clean === "shel") return "shell";
  if (clean === "sh" || clean === "bash" || clean === "zsh") return "bash";
  if (clean === "docker") return "dockerfile";
  if (clean === "yml") return "yaml";
  if (clean === "md") return "markdown";
  if (clean === "golang") return "go";
  if (clean === "py") return "python";
  if (clean === "js") return "javascript";
  if (clean === "ts") return "typescript";
  if (clean === "text" || clean === "txt" || clean === "plaintext" || clean === "raw") return null;
  if (hljs.getLanguage(clean)) return clean;
  return null;
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      const validLang = normalizeLanguage(lang);
      let highlighted: string;
      if (validLang) {
        try {
          highlighted = hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value;
        } catch {
          highlighted = escapeHtml(text);
        }
      } else {
        highlighted = escapeHtml(text);
      }

      const displayLang = (validLang || (lang ? lang.trim() : "")).toLowerCase();
      const langLabelHtml = `<span class="code-block-lang">${escapeHtml(displayLang)}</span>`;
      const codeClass = validLang ? `hljs language-${validLang}` : "hljs raw-code";

      return `<div class="code-block-wrapper"><div class="code-block-header">${langLabelHtml}<button type="button" class="copy-code-btn" aria-label="Copy code">${COPY_ICON_SVG}<span class="copy-code-text">Copy</span></button></div><pre><code class="${codeClass}">${highlighted}</code></pre></div>`;
    }
  }
});

function sanitizeHtml(html: string): string {
  const purify = typeof (DOMPurify as any).sanitize === "function"
    ? (DOMPurify as any)
    : typeof DOMPurify === "function" && typeof window !== "undefined"
      ? (DOMPurify as any)(window)
      : ((DOMPurify as any).default ?? DOMPurify);

  return purify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true },
    FORBID_TAGS: ["style", "iframe", "object", "embed"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["data-task-index", "aria-label", "aria-hidden"]
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
  container.querySelectorAll(".code-block-header").forEach((el) => el.remove());
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
