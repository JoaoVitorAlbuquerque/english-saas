/** Registro central de chaves de cache — evita string solta espalhada pelos apps. */
export const queryKeys = {
  meProfile: ['me', 'profile'] as const,
  placementLatest: ['placement', 'latest'] as const,
};
