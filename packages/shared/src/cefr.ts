import { z } from 'zod';

/**
 * Níveis do CEFR cobertos pelo MVP (A1 → C1).
 * A ordem do array é a ordem de progressão e é usada para comparar níveis.
 */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export const cefrLevelSchema = z.enum(CEFR_LEVELS);

export type CefrLevel = z.infer<typeof cefrLevelSchema>;

/** Rótulos exibidos ao aluno (pt-BR). */
export const CEFR_LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: 'Iniciante',
  A2: 'Básico',
  B1: 'Intermediário',
  B2: 'Intermediário avançado',
  C1: 'Avançado',
};
