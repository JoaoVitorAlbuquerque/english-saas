import { z } from 'zod';

/**
 * Competências avaliadas separadamente no modelo do aluno.
 * O aluno tem um nível CEFR por competência, não um nível único.
 *
 * Em maiúsculo para bater com o enum `Competency` do Prisma: o valor que sai
 * do banco é o mesmo que trafega na API e no front.
 */
export const COMPETENCIES = [
  'GRAMMAR',
  'VOCABULARY',
  'LISTENING',
  'READING',
  'WRITING',
  'SPEAKING',
] as const;

export const competencySchema = z.enum(COMPETENCIES);

export type Competency = z.infer<typeof competencySchema>;

/** Rótulos exibidos ao aluno (pt-BR). */
export const COMPETENCY_LABELS: Record<Competency, string> = {
  GRAMMAR: 'Gramática',
  VOCABULARY: 'Vocabulário',
  LISTENING: 'Compreensão oral',
  READING: 'Leitura',
  WRITING: 'Escrita',
  SPEAKING: 'Fala',
};

/** Idiomas suportados. O MVP entrega apenas inglês. */
export const languageSchema = z.enum(['en']);

export type Language = z.infer<typeof languageSchema>;
