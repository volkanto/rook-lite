import { getLocale } from "./i18n";

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

export const TURKISH_TEMPLATES: NoteTemplate[] = [
  {
    id: "standup",
    name: "Günlük Standup",
    description: "Dün, bugün ve engelleyicileri takip edin",
    tags: ["standup"],
    markdown: `### Günlük Standup

**Dün:**
- [x] 

**Bugün:**
- [ ] 

**Engelleyenler:**
- Yok

#standup`
  },
  {
    id: "meeting",
    name: "Toplantı Notları",
    description: "Katılımcılar, gündem, tartışma notları ve aksiyonlar",
    tags: ["meeting"],
    markdown: `### Toplantı Notları
- **Katılımcılar:** 
- **Hedef:** 

#### Gündem
- 

#### Tartışma Notları
- 

#### Aksiyon Maddeleri
- [ ] 

#meeting`
  },
  {
    id: "reflection",
    name: "Günlük Değerlendirme",
    description: "Akşam günlüğü: öne çıkanlar, öğrenilenler, yarın",
    tags: ["reflection", "journal"],
    markdown: `### Günlük Değerlendirme

- **Öne Çıkanlar:** 
- **Öğrenilenler:** 
- **Geliştirilecek Alanlar:** 
- **Yarının Odağı:** 

#reflection #journal`
  },
  {
    id: "checklist",
    name: "Görev Listesi",
    description: "Hızlı odaklı yapılacaklar listesi",
    tags: ["todos"],
    markdown: `### Aksiyon Maddeleri
- [ ] 
- [ ] 
- [ ] 

#todos`
  },
  {
    id: "project",
    name: "Proje Planı",
    description: "Hedefler, çıktılar ve sıradaki kilometre taşları",
    tags: ["project"],
    markdown: `### Proje Planı
**Hedef:** 

#### Çıktılar
- [ ] 

#### Sıradaki Adımlar
- [ ] 

#project`
  }
];

export function getPredefinedTemplates(locale = getLocale()): NoteTemplate[] {
  return locale === "tr" ? TURKISH_TEMPLATES : PREDEFINED_TEMPLATES;
}

export function getTemplateById(id: string, locale = getLocale()): NoteTemplate | undefined {
  const templates = getPredefinedTemplates(locale);
  return templates.find((t) => t.id === id) ?? PREDEFINED_TEMPLATES.find((t) => t.id === id);
}

export function formatTemplateSnippet(template: NoteTemplate): string {
  return template.markdown;
}
