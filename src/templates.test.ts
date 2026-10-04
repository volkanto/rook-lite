import { describe, expect, it } from "vitest";
import { extractTags } from "./markdown";
import { getPredefinedTemplates, getTemplateById, PREDEFINED_TEMPLATES } from "./templates";

describe("templates", () => {
  it("provides standard pre-defined templates with markdown content and tags", () => {
    expect(PREDEFINED_TEMPLATES.length).toBeGreaterThanOrEqual(4);

    const standup = getTemplateById("standup");
    expect(standup).toBeDefined();
    expect(standup?.name).toBe("Daily Standup");
    expect(standup?.markdown).toContain("#standup");
    expect(standup?.tags).toContain("standup");

    const meeting = getTemplateById("meeting");
    expect(meeting).toBeDefined();
    expect(meeting?.markdown).toContain("#meeting");

    const reflection = getTemplateById("reflection");
    expect(reflection).toBeDefined();
    expect(reflection?.markdown).toContain("#reflection");
  });

  it("provides localized templates for Turkish locale", () => {
    const trTemplates = getPredefinedTemplates("tr");
    expect(trTemplates.length).toBeGreaterThanOrEqual(4);

    const standup = getTemplateById("standup", "tr");
    expect(standup).toBeDefined();
    expect(standup?.name).toBe("Günlük Standup");
    expect(standup?.description).toBe("Dün, bugün ve engelleyicileri takip edin");
    expect(standup?.markdown).toContain("**Dün:**");
    expect(standup?.markdown).toContain("**Bugün:**");
    expect(standup?.markdown).toContain("#standup");

    const meeting = getTemplateById("meeting", "tr");
    expect(meeting).toBeDefined();
    expect(meeting?.name).toBe("Toplantı Notları");
    expect(meeting?.markdown).toContain("Katılımcılar");
  });

  it("places tags at the end of the template after a blank line so extractTags parses them", () => {
    for (const tmpl of PREDEFINED_TEMPLATES) {
      // Tags should not be inside heading title
      expect(tmpl.markdown).not.toMatch(/^#{1,6}\s.*#\w+/m);

      // Tags must be placed at the end preceded by a newline
      expect(tmpl.markdown).toMatch(/\n\n#\w+/);

      // extractTags must successfully parse the template tags
      const extracted = extractTags(tmpl.markdown);
      for (const expectedTag of tmpl.tags) {
        expect(extracted).toContain(expectedTag);
      }
    }
  });

  it("returns undefined for unknown template id", () => {
    expect(getTemplateById("non-existent-template")).toBeUndefined();
  });
});
