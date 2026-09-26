/**
 * O que fazer com cada ponto fraco. Recomendação, nunca trava — a mesma
 * lógica do planner: o que ensina vem antes do que revisa.
 *
 * 1. A lição que ensina a skill, se o aluno ainda não concluiu.
 * 2. A revisão, se ele já tem card daquela skill.
 * 3. Um material gerado (só com o Plus).
 * 4. Refazer a lição, se existir; senão, a prática da agenda de hoje (o
 *    planner já põe fraqueza nos blocos de prática).
 */

export type WeaknessActionType = 'LESSON' | 'REVIEW' | 'MATERIAL' | 'PRACTICE';

export type WeaknessAction = {
  type: WeaknessActionType;
  /** Lição (LESSON) ou card (REVIEW); skill no MATERIAL; nulo na prática. */
  refId: string | null;
  label: string;
};

export function suggestAction(
  weakness: { skillId: string; title: string },
  context: {
    lesson: { lessonId: string; title: string; completed: boolean } | null;
    reviewCardId: string | null;
    canGenerate: boolean;
  },
): WeaknessAction {
  const { lesson } = context;

  if (lesson !== null && !lesson.completed) {
    return {
      type: 'LESSON',
      refId: lesson.lessonId,
      label: `Faça a lição "${lesson.title}"`,
    };
  }

  if (context.reviewCardId !== null) {
    return {
      type: 'REVIEW',
      refId: context.reviewCardId,
      label: 'Revise na sua sessão de revisão',
    };
  }

  if (context.canGenerate) {
    return {
      type: 'MATERIAL',
      refId: weakness.skillId,
      label: `Gere um material que trabalhe "${weakness.title}"`,
    };
  }

  if (lesson !== null) {
    return {
      type: 'LESSON',
      refId: lesson.lessonId,
      label: `Refaça a lição "${lesson.title}"`,
    };
  }

  return {
    type: 'PRACTICE',
    refId: null,
    label: 'Pratique nos exercícios da sua agenda de hoje',
  };
}

/** A lição que ensina cada skill: a primeira do curso que a tem como alvo. */
export function lessonBySkill(
  coursePath: readonly {
    lessonId: string;
    title: string;
    targetSkillIds: readonly string[];
  }[],
): Map<string, { lessonId: string; title: string }> {
  const map = new Map<string, { lessonId: string; title: string }>();

  for (const lesson of coursePath) {
    for (const skillId of lesson.targetSkillIds) {
      if (!map.has(skillId)) {
        map.set(skillId, { lessonId: lesson.lessonId, title: lesson.title });
      }
    }
  }

  return map;
}

/** Acerto de primeira em texto simples. */
export function accuracyLabel(answered: number, correct: number): string {
  if (answered === 0) {
    return 'Sem questões no período';
  }

  const percent = Math.round((correct / answered) * 100);
  return `${String(percent)}% de acerto de primeira (${String(correct)} de ${String(answered)})`;
}
