import type {
  AnswerResult,
  AttemptView,
  CatalogLesson,
  CompletionResult,
} from '@english-saas/api-client';

/**
 * Estado do player: etapa atual, respostas e erros. Reducer puro — sem
 * `fetch`, sem Zustand — para poder testar cada transição isolada. A store
 * (`lesson-store.ts`) só decora isto.
 */

export type LessonState = {
  lesson: CatalogLesson | null;
  attempt: AttemptView | null;
  currentStepIndex: number;
  /**
   * XP da sessão, contado localmente enquanto a lição roda — regra simples e
   * documentada (`round(10 * score)` só na primeira tentativa, 0 na
   * repetição, `learning/domain/xp.ts`). Não é autoritativo: some assim que
   * `completionXp` chega, com o bônus de conclusão de verdade.
   */
  sessionXp: number;
  completionXp: CompletionResult['xp'] | null;
  /** Resposta de cada item já respondido nesta tentativa (a Prática usa para feedback e para saber o que falta). */
  answers: Record<string, AnswerResult>;
  error: string | null;
};

export const initialLessonState: LessonState = {
  lesson: null,
  attempt: null,
  currentStepIndex: 0,
  sessionXp: 0,
  completionXp: null,
  answers: {},
  error: null,
};

export type LessonAction =
  | { type: 'LESSON_LOADED'; lesson: CatalogLesson }
  | { type: 'ATTEMPT_LOADED'; attempt: AttemptView }
  | { type: 'ANSWER_RECEIVED'; itemId: string; result: AnswerResult }
  | { type: 'STEP_COMPLETED'; attempt: AttemptView }
  | { type: 'LESSON_COMPLETED'; result: CompletionResult }
  | { type: 'RESTARTED'; attempt: AttemptView }
  | { type: 'ERROR_RAISED'; message: string }
  | { type: 'ERROR_CLEARED' };

/** Incentivo, não medida de domínio (`XP_RULES` em `learning/domain/xp.ts`). */
export function estimatedAnswerXp(result: AnswerResult): number {
  return result.isFirstTry ? Math.round(10 * result.score) : 0;
}

export function reduceLesson(
  state: LessonState,
  action: LessonAction,
): LessonState {
  switch (action.type) {
    case 'LESSON_LOADED':
      return { ...state, lesson: action.lesson, error: null };

    case 'ATTEMPT_LOADED':
      return {
        ...state,
        attempt: action.attempt,
        currentStepIndex: action.attempt.currentStepIndex,
        error: null,
      };

    case 'ANSWER_RECEIVED':
      return {
        ...state,
        answers: { ...state.answers, [action.itemId]: action.result },
        sessionXp: state.sessionXp + estimatedAnswerXp(action.result),
      };

    case 'STEP_COMPLETED':
      return {
        ...state,
        attempt: action.attempt,
        currentStepIndex: action.attempt.currentStepIndex,
      };

    case 'LESSON_COMPLETED':
      return {
        ...state,
        attempt: action.result.attempt,
        currentStepIndex: action.result.attempt.currentStepIndex,
        completionXp: action.result.xp,
      };

    case 'RESTARTED':
      return {
        ...state,
        attempt: action.attempt,
        currentStepIndex: action.attempt.currentStepIndex,
        sessionXp: 0,
        completionXp: null,
        answers: {},
        error: null,
      };

    case 'ERROR_RAISED':
      return { ...state, error: action.message };

    case 'ERROR_CLEARED':
      return { ...state, error: null };
  }
}
