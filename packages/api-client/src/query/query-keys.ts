/** Registro central de chaves de cache — evita string solta espalhada pelos apps. */
export const queryKeys = {
  meProfile: ['me', 'profile'] as const,
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
};
