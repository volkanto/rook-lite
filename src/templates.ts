export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  markdown: string;
}

export const PREDEFINED_TEMPLATES: NoteTemplate[] = [
  {
    id: "standup",
    name: "Daily Standup",
    description: "Yesterday, today, and blockers tracker",
    tags: ["standup"],
    markdown: `### Daily Standup

**Yesterday:**
- [x] 

**Today:**
- [ ] 

**Blockers:**
- None

#standup`
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    description: "Attendees, agenda, discussion notes, and actions",
    tags: ["meeting"],
    markdown: `### Meeting Notes
- **Attendees:** 
- **Goal:** 

#### Agenda
- 

#### Discussion Notes
- 

#### Action Items
- [ ] 

#meeting`
  },
  {
    id: "reflection",
    name: "Daily Reflection",
    description: "Evening journal: highlights, learnings, tomorrow",
    tags: ["reflection", "journal"],
    markdown: `### Daily Reflection

- **Highlights:** 
- **Learnings:** 
- **Areas to improve:** 
- **Tomorrow's focus:** 

#reflection #journal`
  },
  {
    id: "checklist",
    name: "Task Checklist",
    description: "Quick focused to-do list",
    tags: ["todos"],
    markdown: `### Action Items
- [ ] 
- [ ] 
- [ ] 

#todos`
  },
  {
    id: "project",
    name: "Project Sprint",
    description: "Objectives, deliverables, and next milestones",
    tags: ["project"],
    markdown: `### Project Sprint
**Objective:** 

#### Deliverables
- [ ] 

#### Next Steps
- [ ] 

#project`
  }
];

export function getTemplateById(id: string): NoteTemplate | undefined {
  return PREDEFINED_TEMPLATES.find((t) => t.id === id);
}

export function formatTemplateSnippet(template: NoteTemplate): string {
  return template.markdown;
}
