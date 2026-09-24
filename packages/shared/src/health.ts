import { z } from 'zod';

/**
 * Resposta do `GET /health`, no formato do @nestjs/terminus.
 *
 * `info` traz o que está de pé, `error` o que está fora e `details` a união
 * dos dois — é assim que o terminus responde, e o contrato acompanha.
 */
export const healthIndicatorResultSchema = z.record(
  z.string(),
  z.object({ status: z.enum(['up', 'down']) }).catchall(z.unknown()),
);

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error', 'shutting_down']),
  info: healthIndicatorResultSchema.optional(),
  error: healthIndicatorResultSchema.optional(),
  details: healthIndicatorResultSchema,
});

export type HealthIndicatorResult = z.infer<typeof healthIndicatorResultSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Chaves usadas pelos indicadores de saúde da API. */
export const HEALTH_INDICATORS = {
  DATABASE: 'database',
  REDIS: 'redis',
  STORAGE: 'storage',
} as const;
