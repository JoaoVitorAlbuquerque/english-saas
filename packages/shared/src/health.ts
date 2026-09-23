import { z } from 'zod';

export const dependencyStatusSchema = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  uptimeSeconds: z.number().nonnegative(),
  version: z.string(),
  timestamp: z.string(),
  dependencies: z.object({
    database: dependencyStatusSchema,
    redis: dependencyStatusSchema,
  }),
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
