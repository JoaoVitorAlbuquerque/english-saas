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
};
