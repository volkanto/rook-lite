export interface TranslationStrings {
  // Navigation
  navNotes: string;
  navSummaries: string;
  navSettings: string;
  navCategories: string;
  navData: string;

  // Tooltips & Accessibility
  brandTooltip: string;
  collapseSidebar: string;
  closeSidebar: string;
  closeDialog: string;
  closeEditor: string;
  openSearch: string;
  openCalendar: string;
  searchPlaceholder: string;
  searchDialogTitle: string;
  searchInputPlaceholder: string;
  themeToggleDark: string;
  themeToggleLight: string;
  themeToggleAria: string;
  localOnlyTooltip: string;
  languageSelectTooltip: string;
  githubTooltip: string;

  // Today / Notes View
  today: string;
  yesterday: string;
  tomorrow: string;
  daysAgo: (count: number) => string;
  daysLater: (count: number) => string;
  previousDay: string;
  nextDay: string;
  liveTimeTooltip: string;
  viewingArchivedDate: string;
  viewingFutureDate: string;
  recordSubtitle: string;
  finishNote: string;
  composerPlaceholder: string;
  draftRestored: string;
  draftSaved: string;
  savingDraft: string;
  markdownSupported: string;
  notesTitle: string;
  entrySingle: string;
  entryPlural: string;
  filterAll: string;
  filterByTag: string;
  noNotesToday: string;
  noNotesForTag: (tag: string) => string;
  emptyNotesPrompt: string;
  editNote: string;
  deleteNote: string;
  actionsForNote: (title: string) => string;

  // Edit Dialog
  editNoteTitle: string;
  saveChanges: string;
  cancel: string;

  // Delete Confirm Dialog
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  replaceDataTitle: string;
  replaceDataMessage: (notes: number, cats: number, sums: number) => string;
  restoreBackupBtn: string;

  // Search Modal & Page
  searchTitle: string;
  searchLede: string;
  searchFromLabel: string;
  searchToLabel: string;
  searchAllCategories: string;
  searchContentTagged: string;
  searchContentUntagged: string;
  clearSearchBtn: string;
  quickActionsLabel: string;
  newNoteCommand: string;
  generateSummaryCommand: string;
  settingsCommand: string;
  noNotesYet: string;
  noNotesYetPrompt: string;
  matchingNotesLabel: string;
  noNotesFound: string;
  noNotesFoundPrompt: string;
  untitledNote: string;
  searchPaletteAllTags: string;
  searchPeriodAny: string;
  searchPeriodWeek: string;
  searchPeriodMonth: string;
  searchOpenTasks: string;
  searchMoreFilters: string;
  searchRecentNotes: string;
  searchNoResults: string;
  searchNoResultsDesc: string;
  searchHintNavigate: string;
  searchHintOpen: string;
  searchHintClose: string;
  searchQueryLabel: string;
  searchQueryPlaceholder: string;
  searchCategoryLabel: string;
  searchContentLabel: string;
  searchContentAll: string;
  searchContentOnlyTodos: string;
  searchSortLabel: string;
  searchSortNewest: string;
  searchSortOldest: string;

  // Summaries View
  summariesTitle: string;
  summariesLede: string;
  thisWeek: string;
  thisMonth: string;
  customRange: string;
  dateInPeriod: string;
  startDate: string;
  endDate: string;
  summaryMode: string;
  modeRuleBased: string;
  modeRuleBasedDesc: string;
  modeOllama: string;
  modeOllamaDesc: string;
  modeOllamaDisabledDesc: string;
  modeRaw: string;
  modeRawDesc: string;
  generateSummary: string;
  regenerateSummary: string;
  generating: string;
  copySummary: string;
  exportSummary: string;
  summarySourceCount: (count: number, range: string) => string;
  weekLabel: (weekNumber: number) => string;
  ollamaFallbackNotice: (error: string) => string;
  noSummaryYet: string;
  noSummaryYetDesc: (hasNotes: boolean) => string;
  editMarkdown: string;
  rawNotesInPeriod: (count: number) => string;
  readyStatus: string;
  editedPill: string;

  // Todos View
  todosTitle: string;
  todosLede: string;
  noOpenTasks: string;
  noOpenTasksPrompt: string;

  // Common UI
  editAction: string;
  deleteAction: string;
  categoryRemovedHelp: string;
  estimatedUsage: string;
  dayHasNotes: string;
  weeklyTotalsRight: string;
  noNotesOnDay: string;

  // Settings View
  settingsTitle: string;
  settingsLede: string;

  // Language settings
  languageTitle: string;
  languageSubtitle: string;

  // Appearance settings
  appearanceTitle: string;
  appearanceSubtitle: string;
  themeSystem: string;
  themeSystemDesc: string;
  themeLight: string;
  themeLightDesc: string;
  themeDark: string;
  themeDarkDesc: string;

  // Local AI settings
  localAiTitle: string;
  localAiBadge: string;
  localAiSubtitle: string;
  localAiDisabledTitle: string;
  localAiDisabledDesc: string;
  ollamaEndpointLabel: string;
  ollamaEndpointHint: string;
  ollamaModelLabel: string;
  ollamaModelHint: string;
  ollamaTempLabel: string;
  ollamaTempPrecise: string;
  ollamaTempBalanced: string;
  ollamaTempCreative: string;
  ollamaSystemPromptLabel: string;
  ollamaSystemPromptHint: string;
  resetToDefault: string;
  testConnectionBtn: string;
  saveAiSettingsBtn: string;
  testingConnection: string;
  connectedModelsFound: (count: number) => string;
  connectedNoModels: string;
  aiSettingsSaved: string;
  localAiEnabled: string;
  localAiDisabled: string;

  // Storage & Persistence settings
  storageTitle: string;
  storageSubtitle: string;
  metricNotes: string;
  metricCategories: string;
  metricSummaries: string;
  metricDrafts: string;
  persistenceTitle: string;
  persistenceDesc: string;
  persistencePersisted: string;
  persistenceBestEffort: string;
  requestPersistenceBtn: string;
  dangerZoneTitle: string;
  dangerZoneSubtitle: string;
  clearAllDataBtn: string;
  clearConfirmTitle: string;
  clearConfirmMessage: string;
  clearAllAction: string;

  // Data management
  dataManagementTitle: string;
  dataManagementSubtitle: string;
  markdownExportTitle: string;
  markdownExportSubtitle: string;
  lastExportPrefix: string;
  noExportYet: string;
  chooseExportFolderBtn: string;
  downloadZipBtn: string;
  fullBackupTitle: string;
  fullBackupSubtitle: string;
  createJsonBackupBtn: string;
  restoreJsonBackupLabel: string;
  exportedNotesCount: (count: number) => string;

  // Categories View
  categoriesTitle: string;
  categoriesLede: string;
  newCategory: string;
  createCategoryHeading: string;
  createCategoryHelp: string;
  categoryNameLabel: string;
  categoryNamePlaceholder: string;
  createCategoryBtn: string;
  activeCategories: string;
  activeCategoriesHelp: string;
  noActiveCategories: string;
  createOneToStart: string;
  archivedCategories: string;
  archivedCategoriesHelp: string;
  archiveCategoryBtn: string;
  deleteCategoryBtn: string;
  deleteCategoryConfirmTitle: string;
  deleteCategoryConfirmMessage: string;
  noCategoriesInPicker: string;

  // General & Not Found
  aboutTitle: string;
  aboutSubtitle: string;
  notFoundTitle: string;
  notFoundDesc: string;
  notFoundReturnHome: string;
}

export interface LocaleDefinition {
  code: string;
  label: string;
  description: string;
  dateTimeLocale?: string;
  dayInitials?: string[];
  dayNames?: string[];
  strings: TranslationStrings;
}
