import type { LearnerProfile } from '@english-saas/api-client';

/** Quantas frases do aluno mostrar por erro — duas ou três bastam para ele se reconhecer. */
export const MAX_EXAMPLES = 3;

/**
 * As frases reais do aluno para um erro. O painel de progresso (14) traz o
 * erro e a tendência, mas não os exemplos; esses moram no perfil do modelo
 * (7), em `errors` (recorrentes) ou `observedErrors` (vistos poucas vezes),
 * ligados pelo mesmo id.
 *
 * Sem perfil (ainda carregando ou falhou) ou sem frase guardada: lista vazia
 * — o erro continua na tela, só sem exemplo.
 */
export function examplesFor(
  errorPatternId: string,
  profile: LearnerProfile | undefined,
): string[] {
  if (profile === undefined) {
    return [];
  }

  const match = [...profile.errors, ...profile.observedErrors].find(
    (error) => error.id === errorPatternId,
  );

  return [...new Set(match?.yourExamples ?? [])].slice(0, MAX_EXAMPLES);
}
