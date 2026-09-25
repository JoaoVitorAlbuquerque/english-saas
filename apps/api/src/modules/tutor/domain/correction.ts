/**
 * Correção de produção livre: o que confiar na saída da IA e o que ela vira
 * para o modelo do aluno. Funções puras.
 */

export type Fix = {
  original: string;
  suggestion: string;
  explanationPtBr: string;
  errorPatternId: string | null;
  skillId: string | null;
  severity: 'MINOR' | 'MAJOR';
};

export type CorrectionOutput = {
  safety: 'OK' | 'INAPPROPRIATE';
  corrected: string;
  fixes: Fix[];
  rubric: { goalId: string; met: boolean; comment: string }[];
  registerTips: {
    yourForm: string;
    naturalSpokenForm: string;
    standardForm: string;
    note: string;
  }[];
  encouragement: string;
  estimatedLevel: string;
};

export type RubricCriterion = {
  id: string;
  skillId: string | null;
  errorPatternId: string | null;
};

export type TutorFeedback = {
  errorPatterns: { id: string; text: string; correction: string }[];
  checkedErrorPatternIds: string[];
  skills: { skillId: string; met: boolean }[];
  expressionSkillIds: string[];
};

/**
 * A IA só pode citar id que recebeu. O que ela inventar vira `null` (erro e
 * skill) ou sai da lista (critério da rubrica) — melhor perder um mapeamento
 * que gravar no perfil do aluno um erro que não existe.
 */
export function sanitizeCorrection(
  output: CorrectionOutput,
  allowed: {
    errorPatternIds: ReadonlySet<string>;
    skillIds: ReadonlySet<string>;
    rubricIds: ReadonlySet<string>;
  },
): CorrectionOutput {
  const seenGoals = new Set<string>();

  return {
    ...output,
    fixes: output.fixes.map((fix) => ({
      ...fix,
      errorPatternId:
        fix.errorPatternId !== null &&
        allowed.errorPatternIds.has(fix.errorPatternId)
          ? fix.errorPatternId
          : null,
      skillId:
        fix.skillId !== null && allowed.skillIds.has(fix.skillId)
          ? fix.skillId
          : null,
    })),
    rubric: output.rubric.filter((item) => {
      if (!allowed.rubricIds.has(item.goalId) || seenGoals.has(item.goalId)) {
        return false;
      }
      seenGoals.add(item.goalId);
      return true;
    }),
  };
}

/**
 * O feedback que vai para o learner-model (7) e o SRS (9).
 *
 * - Erro cometido: cada ErrorPattern uma vez, com o trecho real do aluno.
 * - Erro checado: os ErrorPatterns que a rubrica mandava vigiar — os que
 *   não foram cometidos contam como oportunidade sem erro.
 * - Skills: o critério da rubrica diz se cumpriu; correção MAJOR numa skill
 *   conta como não cumprida (vale o pior).
 */
export function feedbackFromCorrection(input: {
  output: CorrectionOutput;
  rubric: readonly RubricCriterion[];
}): TutorFeedback {
  const errors = new Map<
    string,
    { id: string; text: string; correction: string }
  >();

  for (const fix of input.output.fixes) {
    if (fix.errorPatternId !== null && !errors.has(fix.errorPatternId)) {
      errors.set(fix.errorPatternId, {
        id: fix.errorPatternId,
        text: fix.original,
        correction: fix.suggestion,
      });
    }
  }

  const skills = new Map<string, boolean>();
  const met = (skillId: string, value: boolean) =>
    skills.set(skillId, (skills.get(skillId) ?? true) && value);

  const verdicts = new Map(
    input.output.rubric.map((item) => [item.goalId, item.met]),
  );

  for (const criterion of input.rubric) {
    const verdict = verdicts.get(criterion.id);
    if (criterion.skillId !== null && verdict !== undefined) {
      met(criterion.skillId, verdict);
    }
  }

  for (const fix of input.output.fixes) {
    if (fix.skillId !== null && fix.severity === 'MAJOR') {
      met(fix.skillId, false);
    }
  }

  return {
    errorPatterns: [...errors.values()],
    checkedErrorPatternIds: [
      ...new Set(
        input.rubric.flatMap((criterion) =>
          criterion.errorPatternId === null ? [] : [criterion.errorPatternId],
        ),
      ),
    ],
    skills: [...skills.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([skillId, value]) => ({ skillId, met: value })),
    expressionSkillIds: [],
  };
}
