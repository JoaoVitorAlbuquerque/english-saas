import type { TutorFeedback } from './correction';

/** Falas impróprias que encerram a sessão. */
export const MAX_STRIKES = 2;
export const TOP_CORRECTIONS = 3;

/** O que o aluno vê no lugar da fala do personagem quando passou do limite. */
export const INAPPROPRIATE_REPLY =
  'Vamos manter a conversa respeitosa e dentro da cena. Tenta de novo?';

export type RoleplayGoal = {
  id: string;
  description: string;
  skillIds: string[];
};

export type TurnOutput = {
  safety: 'OK' | 'OFF_TOPIC' | 'INAPPROPRIATE';
  goalsMet: string[];
  isFinished: boolean;
};

export type SessionState = {
  goals: readonly RoleplayGoal[];
  goalsMet: readonly string[];
  studentTurns: number;
  maxTurns: number;
  strikes: number;
};

/** STUDENT = o aluno encerrou antes. */
export type FinishReason =
  'GOALS' | 'TURNS' | 'CHARACTER' | 'STRIKES' | 'STUDENT';

/** O menor entre o que a etapa prevê e o que o plano do aluno paga. */
export function turnLimit(stepMaxTurns: number, planCap: number): number {
  return Math.max(1, Math.min(stepMaxTurns, planCap));
}

export function canTakeTurn(state: {
  status: string;
  studentTurns: number;
  maxTurns: number;
}): boolean {
  return state.status === 'ACTIVE' && state.studentTurns < state.maxTurns;
}

/**
 * Aplica a resposta de um turno. Fora do cenário ou impróprio não cumpre
 * meta; impróprio conta strike. A sessão acaba quando todas as metas foram
 * cumpridas, os turnos acabaram, o personagem encerrou ou vieram 2 strikes.
 */
export function applyTurn(
  state: SessionState,
  output: TurnOutput,
): { goalsMet: string[]; strikes: number; finished: FinishReason | null } {
  const valid = new Set(state.goals.map((goal) => goal.id));
  const earned =
    output.safety === 'OK' ? output.goalsMet.filter((id) => valid.has(id)) : [];
  const goalsMet = [...new Set([...state.goalsMet, ...earned])].sort();
  const strikes = state.strikes + (output.safety === 'INAPPROPRIATE' ? 1 : 0);

  const finished: FinishReason | null =
    strikes >= MAX_STRIKES
      ? 'STRIKES'
      : goalsMet.length === valid.size
        ? 'GOALS'
        : state.studentTurns >= state.maxTurns
          ? 'TURNS'
          : output.isFinished
            ? 'CHARACTER'
            : null;

  return { goalsMet, strikes, finished };
}

export type TurnFeedback = {
  inlineCorrection: {
    original: string;
    suggestion: string;
    explanationPtBr: string;
    errorPatternId: string | null;
  } | null;
  expressionSkillIds: string[];
};

export type RoleplaySummary = {
  goals: { id: string; description: string; met: boolean }[];
  topCorrections: NonNullable<TurnFeedback['inlineCorrection']>[];
  expressionSkillIds: string[];
  finishedBy: FinishReason;
};

/**
 * Resumo do fim, sem nova chamada de IA: as metas, as 3 correções principais
 * (primeiro as que batem com um erro típico do catálogo, sem repetir o mesmo
 * trecho) e as expressões do catálogo que apareceram.
 */
export function buildSummary(input: {
  goals: readonly RoleplayGoal[];
  goalsMet: readonly string[];
  turns: readonly TurnFeedback[];
  finishedBy: FinishReason;
}): RoleplaySummary {
  const met = new Set(input.goalsMet);
  const corrections = input.turns.flatMap((turn) =>
    turn.inlineCorrection === null ? [] : [turn.inlineCorrection],
  );
  const seen = new Set<string>();
  const topCorrections = [
    ...corrections.filter((c) => c.errorPatternId !== null),
    ...corrections.filter((c) => c.errorPatternId === null),
  ]
    .filter((c) => {
      const key = c.original.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, TOP_CORRECTIONS);

  return {
    goals: input.goals.map((goal) => ({
      id: goal.id,
      description: goal.description,
      met: met.has(goal.id),
    })),
    topCorrections,
    expressionSkillIds: [
      ...new Set(input.turns.flatMap((turn) => turn.expressionSkillIds)),
    ].sort(),
    finishedBy: input.finishedBy,
  };
}

/** O roleplay vira o mesmo `tutor.feedback` da correção. */
export function feedbackFromRoleplay(input: {
  summary: RoleplaySummary;
  goals: readonly RoleplayGoal[];
  turns: readonly TurnFeedback[];
}): TutorFeedback {
  const errors = new Map<
    string,
    { id: string; text: string; correction: string }
  >();

  for (const turn of input.turns) {
    const correction = turn.inlineCorrection;
    if (
      correction?.errorPatternId != null &&
      !errors.has(correction.errorPatternId)
    ) {
      errors.set(correction.errorPatternId, {
        id: correction.errorPatternId,
        text: correction.original,
        correction: correction.suggestion,
      });
    }
  }

  // Só meta cumprida vira evidência. Não chegar numa meta (acabaram os
  // turnos, a conversa foi para outro lado) não prova que o aluno não sabe.
  const met = new Set(
    input.summary.goals.filter((goal) => goal.met).map((goal) => goal.id),
  );
  const skillIds = new Set(
    input.goals
      .filter((goal) => met.has(goal.id))
      .flatMap((goal) => goal.skillIds),
  );

  return {
    errorPatterns: [...errors.values()],
    checkedErrorPatternIds: [],
    skills: [...skillIds].sort().map((skillId) => ({ skillId, met: true })),
    expressionSkillIds: input.summary.expressionSkillIds,
  };
}
