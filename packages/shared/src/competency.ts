import { z } from 'zod';

/**
 * Competências avaliadas separadamente no modelo do aluno.
 * O aluno tem um nível CEFR por competência, não um nível único.
 */
export const COMPETENCIES = [
  'grammar',
  'vocabulary',
  'listening',
  'reading',
  'writing',
  'speaking',
] as const;

export const competencySchema = z.enum(COMPETENCIES);

export type Competency = z.infer<typeof competencySchema>;

/** Rótulos exibidos ao aluno (pt-BR). */
export const COMPETENCY_LABELS: Record<Competency, string> = {
  grammar: 'Gramática',
  vocabulary: 'Vocabulário',
  listening: 'Compreensão oral',
  reading: 'Leitura',
  writing: 'Escrita',
  speaking: 'Fala',
};

/** Idiomas suportados. O MVP entrega apenas inglês. */
export const languageSchema = z.enum(['en']);

export type Language = z.infer<typeof languageSchema>;
