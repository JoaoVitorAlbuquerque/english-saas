import { z } from 'zod';

/**
 * `GET /me/learner-profile` (módulo 7). A tela de progresso só precisa dos
 * erros, porque é aqui que moram as **frases reais do aluno** (`yourExamples`)
 * que o painel do módulo 14 não traz. O zod ignora o resto do perfil.
 */

export const learnerErrorSchema = z.object({
  id: z.string(),
  description: z.string(),
  correction: z.string(),
  explanation: z.string(),
  occurrences: z.number(),
  yourExamples: z.array(z.string()),
});
export type LearnerError = z.infer<typeof learnerErrorSchema>;

export const learnerProfileSchema = z.object({
  /** Erros que já se repetem (fraqueza). */
  errors: z.array(learnerErrorSchema),
  /** Erros vistos poucas vezes — ainda não são fraqueza. */
  observedErrors: z.array(learnerErrorSchema),
});
export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
