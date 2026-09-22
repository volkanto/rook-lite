import DOMPurify from "dompurify";
import { marked } from "marked";

marked.use({ gfm: true, breaks: false });

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false });
  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "iframe", "object", "embed"],
    FORBID_ATTR: ["style"]
  });
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
