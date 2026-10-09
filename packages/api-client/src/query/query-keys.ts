/** Registro central de chaves de cache — evita string solta espalhada pelos apps. */
export const queryKeys = {
  meProfile: ['me', 'profile'] as const,
  meInterests: ['me', 'interests'] as const,
  meConsents: ['me', 'consents'] as const,
  meExport: ['me', 'export'] as const,
  meNotificationPreferences: ['me', 'notifications', 'preferences'] as const,
  meProgress: (weeks: number) => ['me', 'progress', weeks] as const,
  meLearnerProfile: ['me', 'learner-profile'] as const,
  placementLatest: ['placement', 'latest'] as const,
  lesson: (slug: string) => ['lesson', slug] as const,
  correction: (id: string) => ['tutor', 'correction', id] as const,
  roleplay: (id: string) => ['tutor', 'roleplay', id] as const,
  mePlan: ['me', 'plan'] as const,
  mePlanForecast: ['me', 'plan', 'forecast'] as const,
  meStats: ['me', 'stats'] as const,
  meAgenda: ['me', 'agenda'] as const,
  reviewSession: (minutes: number) => ['reviews', 'session', minutes] as const,
  catalogLevels: ['catalog', 'levels'] as const,
  catalogUnits: (level?: string) =>
    ['catalog', 'units', level ?? 'all'] as const,
  catalogUnit: (slug: string) => ['catalog', 'unit', slug] as const,
  catalogWorkbooks: (level?: string) =>
    ['catalog', 'workbooks', level ?? 'all'] as const,
  meHistory: ['me', 'history'] as const,
  plans: ['plans'] as const,
  meSubscription: ['me', 'subscription'] as const,
  meCredits: ['me', 'credits'] as const,
  meCreditsHistory: ['me', 'credits', 'history'] as const,
  generationJob: (id: string) => ['generator', 'job', id] as const,
  meMaterials: ['me', 'materials'] as const,
  material: (id: string) => ['me', 'materials', id] as const,
  adminCourses: ['admin', 'courses'] as const,
  adminUnits: (levelId?: string) =>
    ['admin', 'units', levelId ?? 'all'] as const,
  adminLessons: (unitId?: string) =>
    ['admin', 'lessons', unitId ?? 'all'] as const,
  adminLesson: (id: string) => ['admin', 'lesson', id] as const,
  adminVersion: (id: string) => ['admin', 'version', id] as const,
  adminPreview: (id: string) => ['admin', 'preview', id] as const,
  adminCharacters: ['admin', 'characters'] as const,
  adminSkills: (q: string, type?: string) =>
    ['admin', 'skills', q, type ?? 'all'] as const,
  adminRegisterNotes: ['admin', 'register-notes'] as const,
  adminErrorPatterns: ['admin', 'error-patterns'] as const,
  adminSkillList: (filter: object) => ['admin', 'skill-list', filter] as const,
  adminErrorPatternList: (filter: object) =>
    ['admin', 'error-pattern-list', filter] as const,
  adminRegisterNoteList: (filter: object) =>
    ['admin', 'register-note-list', filter] as const,
  adminItemList: (filter: object) => ['admin', 'item-list', filter] as const,
  adminItem: (id: string) => ['admin', 'item', id] as const,
  adminItemStats: (id: string) => ['admin', 'item-stats', id] as const,
  adminFlaggedItems: (filter: object) =>
    ['admin', 'flagged-items', filter] as const,
  studioDrafts: (filter: object) =>
    ['admin', 'studio', 'drafts', filter] as const,
  studioEstimate: (kind: string, count: number) =>
    ['admin', 'studio', 'estimate', kind, count] as const,
  studioQa: (versionId: string) =>
    ['admin', 'studio', 'qa', versionId] as const,
  studioComments: (versionId: string, includeResolved: boolean) =>
    ['admin', 'studio', 'comments', versionId, includeResolved] as const,
  studioAudio: (versionId: string) =>
    ['admin', 'studio', 'audio', versionId] as const,
  studioWorkbooks: ['admin', 'studio', 'workbooks'] as const,
  studioJob: (id: string) => ['admin', 'studio', 'job', id] as const,
  adminUsers: (filter: object) => ['admin', 'users', filter] as const,
  /** Prefixo de tudo da ficha de um aluno — `invalidateQueries` por aqui. */
  adminStudent: (id: string) => ['admin', 'student', id] as const,
  adminStudentOverview: (id: string) =>
    ['admin', 'student', id, 'overview'] as const,
  adminStudentProgress: (id: string, weeks: number) =>
    ['admin', 'student', id, 'progress', weeks] as const,
  adminStudentPlan: (id: string) => ['admin', 'student', id, 'plan'] as const,
  adminStudentHistory: (id: string) =>
    ['admin', 'student', id, 'history'] as const,
  adminStudentSubscription: (id: string) =>
    ['admin', 'student', id, 'subscription'] as const,
  adminStudentCredits: (id: string) =>
    ['admin', 'student', id, 'credits'] as const,
  adminStudentCreditHistory: (id: string) =>
    ['admin', 'student', id, 'credits', 'history'] as const,
  adminStudentAiUsage: (id: string) =>
    ['admin', 'student', id, 'ai-usage'] as const,
  adminPlans: ['admin', 'billing', 'plans'] as const,
  adminCreditCosts: ['admin', 'billing', 'credit-costs'] as const,
  adminMetrics: (range: object | null) => ['admin', 'metrics', range] as const,
  /** Prefixo do log — toda ação de admin invalida por aqui. */
  adminAuditAll: ['admin', 'audit'] as const,
  adminAudit: (filter: object) => ['admin', 'audit', filter] as const,
};
