/**
 * XP.
 *
 * Regras simples de propósito — XP aqui é incentivo, não medida de
 * domínio (isso é o mastery do módulo 7):
 *
 * - cada questão vale até 10, proporcional ao score, **só na primeira
 *   tentativa**. Refazer até acertar não rende XP, mas também não tira;
 * - dica não reduz nada;
 * - concluir a lição vale 20; concluir de novo uma lição que o aluno já
 *   terminou antes vale 5. Não é punição — é o que impede farmar XP
 *   repetindo a lição mais curta.
 */

export const XP_RULES = {
  perItem: 10,
  lessonCompletion: 20,
  lessonReplayCompletion: 5,
} as const;

export function answerXp(answer: {
  score: number;
  isFirstTry: boolean;
}): number {
  return answer.isFirstTry ? Math.round(XP_RULES.perItem * answer.score) : 0;
}

export type LessonXp = {
  fromAnswers: number;
  completionBonus: number;
  total: number;
};

export function lessonXp(input: {
  answers: readonly { score: number; isFirstTry: boolean }[];
  completedBefore: boolean;
}): LessonXp {
  const fromAnswers = input.answers.reduce(
    (sum, answer) => sum + answerXp(answer),
    0,
  );
  const completionBonus = input.completedBefore
    ? XP_RULES.lessonReplayCompletion
    : XP_RULES.lessonCompletion;

  return { fromAnswers, completionBonus, total: fromAnswers + completionBonus };
}
