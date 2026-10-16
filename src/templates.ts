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
  const code = locale.toLowerCase();
  if (code === "tr") return TURKISH_TEMPLATES;
  if (code === "de") return GERMAN_TEMPLATES;
  if (code === "es") return SPANISH_TEMPLATES;
  if (code === "fr") return FRENCH_TEMPLATES;
  if (code === "pt-br") return PORTUGUESE_TEMPLATES;
  return PREDEFINED_TEMPLATES;
}

export const GERMAN_TEMPLATES: NoteTemplate[] = [
  {
    id: "standup",
    name: "Tägliches Standup",
    description: "Gestern, heute und Blocker festhalten",
    tags: ["standup"],
    markdown: `### Tägliches Standup

**Gestern:**
- [x] 

**Heute:**
- [ ] 

**Blocker:**
- Keine

#standup`
  },
  {
    id: "meeting",
    name: "Meetingnotizen",
    description: "Teilnehmer, Agenda, Diskussionspunkte und Aufgaben",
    tags: ["meeting"],
    markdown: `### Meetingnotizen
- **Teilnehmer:** 
- **Ziel:** 

#### Agenda
- 

#### Notizen
- 

#### Aufgaben
- [ ] 

#meeting`
  },
  {
    id: "reflection",
    name: "Tägliche Reflexion",
    description: "Abendjournal: Highlights, Gelerntes und Fokus für morgen",
    tags: ["reflection", "journal"],
    markdown: `### Tägliche Reflexion

- **Highlights:** 
- **Gelerntes:** 
- **Verbesserungspotenzial:** 
- **Fokus für morgen:** 

#reflection #journal`
  },
  {
    id: "checklist",
    name: "Checkliste",
    description: "Fokussierte To-do-Liste",
    tags: ["todos"],
    markdown: `### Aufgaben
- [ ] 
- [ ] 
- [ ] 

#todos`
  },
  {
    id: "project",
    name: "Projektsprint",
    description: "Ziele, Ergebnisse und nächste Meilensteine",
    tags: ["project"],
    markdown: `### Projektsprint
**Ziel:** 

#### Ergebnisse
- [ ] 

#### Nächste Schritte
- [ ] 

#project`
  }
];

export const SPANISH_TEMPLATES: NoteTemplate[] = [
  {
    id: "standup",
    name: "Standup diario",
    description: "Seguimiento de ayer, hoy y bloqueos",
    tags: ["standup"],
    markdown: `### Standup diario

**Ayer:**
- [x] 

**Hoy:**
- [ ] 

**Bloqueos:**
- Ninguno

#standup`
  },
  {
    id: "meeting",
    name: "Notas de reunión",
    description: "Asistentes, objetivos, debate y tareas acordadas",
    tags: ["meeting"],
    markdown: `### Notas de reunión
- **Asistentes:** 
- **Objetivo:** 

#### Agenda
- 

#### Puntos discutidos
- 

#### Tareas acordadas
- [ ] 

#meeting`
  },
  {
    id: "reflection",
    name: "Reflexión diaria",
    description: "Diario vespertino: logros, aprendizajes y foco de mañana",
    tags: ["reflection", "journal"],
    markdown: `### Reflexión diaria

- **Logros:** 
- **Aprendizajes:** 
- **Áreas a mejorar:** 
- **Foco de mañana:** 

#reflection #journal`
  },
  {
    id: "checklist",
    name: "Lista de tareas",
    description: "Lista rápida de pendientes",
    tags: ["todos"],
    markdown: `### Tareas pendientes
- [ ] 
- [ ] 
- [ ] 

#todos`
  },
  {
    id: "project",
    name: "Sprint de proyecto",
    description: "Objetivos, entregables y próximos hitos",
    tags: ["project"],
    markdown: `### Sprint de proyecto
**Objetivo:** 

#### Entregables
- [ ] 

#### Próximos pasos
- [ ] 

#project`
  }
];

export const FRENCH_TEMPLATES: NoteTemplate[] = [
  {
    id: "standup",
    name: "Standup quotidien",
    description: "Suivi d'hier, d'aujourd'hui et des blocages",
    tags: ["standup"],
    markdown: `### Standup quotidien

**Hier :**
- [x] 

**Aujourd'hui :**
- [ ] 

**Blocages :**
- Aucun

#standup`
  },
  {
    id: "meeting",
    name: "Notes de réunion",
    description: "Participants, ordre du jour, discussions et actions",
    tags: ["meeting"],
    markdown: `### Notes de réunion
- **Participants :** 
- **Objectif :** 

#### Ordre du jour
- 

#### Discussions
- 

#### Actions à mener
- [ ] 

#meeting`
  },
  {
    id: "reflection",
    name: "Bilan du jour",
    description: "Journal du soir : réussites, apprentissages et priorité de demain",
    tags: ["reflection", "journal"],
    markdown: `### Bilan du jour

- **Réussites :** 
- **Apprentissages :** 
- **Points à améliorer :** 
- **Priorité de demain :** 

#reflection #journal`
  },
  {
    id: "checklist",
    name: "Liste de contrôle",
    description: "Liste rapide de choses à faire",
    tags: ["todos"],
    markdown: `### Actions
- [ ] 
- [ ] 
- [ ] 

#todos`
  },
  {
    id: "project",
    name: "Sprint de projet",
    description: "Objectifs, livrables et prochains jalons",
    tags: ["project"],
    markdown: `### Sprint de projet
**Objectif :** 

#### Livrables
- [ ] 

#### Prochaines étapes
- [ ] 

#project`
  }
];

export const PORTUGUESE_TEMPLATES: NoteTemplate[] = [
  {
    id: "standup",
    name: "Standup diário",
    description: "Acompanhamento de ontem, hoje e impedimentos",
    tags: ["standup"],
    markdown: `### Standup diário

**Ontem:**
- [x] 

**Hoje:**
- [ ] 

**Impedimentos:**
- Nenhum

#standup`
  },
  {
    id: "meeting",
    name: "Anotações de reunião",
    description: "Participantes, pauta, discussões e ações",
    tags: ["meeting"],
    markdown: `### Anotações de reunião
- **Participantes:** 
- **Objetivo:** 

#### Pauta
- 

#### Discussão
- 

#### Ações a realizar
- [ ] 

#meeting`
  },
  {
    id: "reflection",
    name: "Reflexão diária",
    description: "Diário da noite: destaques, aprendizados e foco de amanhã",
    tags: ["reflection", "journal"],
    markdown: `### Reflexão diária

- **Destaques:** 
- **Aprendizados:** 
- **Áreas a melhorar:** 
- **Foco para amanhã:** 

#reflection #journal`
  },
  {
    id: "checklist",
    name: "Lista de tarefas",
    description: "Lista rápida de afazeres",
    tags: ["todos"],
    markdown: `### Ações
- [ ] 
- [ ] 
- [ ] 

#todos`
  },
  {
    id: "project",
    name: "Sprint de projeto",
    description: "Objetivos, entregáveis e próximos marcos",
    tags: ["project"],
    markdown: `### Sprint de projeto
**Objetivo:** 

#### Entregáveis
- [ ] 

#### Próximos passos
- [ ] 

#project`
  }
];

export function getTemplateById(id: string, locale = getLocale()): NoteTemplate | undefined {
  const templates = getPredefinedTemplates(locale);
  return templates.find((t) => t.id === id) ?? PREDEFINED_TEMPLATES.find((t) => t.id === id);
}

export function formatTemplateSnippet(template: NoteTemplate): string {
  return template.markdown;
}
