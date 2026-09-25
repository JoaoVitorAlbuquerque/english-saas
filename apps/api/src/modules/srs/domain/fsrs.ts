import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';
import type { Card, Grade } from 'ts-fsrs';

/**
 * Encapsula o `ts-fsrs`: o resto do módulo nunca importa a lib direto, só
 * este tipo e estas duas funções. `now` sempre entra por parâmetro — o
 * `next()` do ts-fsrs aceita, então o wrapper continua puro.
 */

export type FsrsRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

/** Mesmos quatro estados do `State` do ts-fsrs — é o que `ReviewCard.state` guarda. */
export type FsrsCardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

export type ReviewCardFsrsState = {
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: FsrsCardState;
  lastReviewedAt: Date | null;
};

const scheduler = fsrs();

const GRADE_OF: Record<FsrsRating, Grade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
};

const DOMAIN_STATE_OF: Record<State, FsrsCardState> = {
  [State.New]: 'NEW',
  [State.Learning]: 'LEARNING',
  [State.Review]: 'REVIEW',
  [State.Relearning]: 'RELEARNING',
};

const FSRS_STATE_OF: Record<FsrsCardState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

function toCard(state: ReviewCardFsrsState): Card {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    // Campo depreciado na lib; o algoritmo recalcula a partir de
    // `last_review` e `now` a cada chamada, então 0 aqui não afeta nada.
    elapsed_days: 0,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: FSRS_STATE_OF[state.state],
    ...(state.lastReviewedAt === null
      ? {}
      : { last_review: state.lastReviewedAt }),
  };
}

function fromCard(card: Card): ReviewCardFsrsState {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: DOMAIN_STATE_OF[card.state],
    lastReviewedAt: card.last_review ?? null,
  };
}

/** Estado inicial de um card recém-criado (`state: NEW`). */
export function emptyCardState(now: Date): ReviewCardFsrsState {
  return fromCard(createEmptyCard(now));
}

/** Aplica um rating e devolve o novo estado, com o `due` recalculado. */
export function scheduleReview(
  state: ReviewCardFsrsState,
  rating: FsrsRating,
  now: Date,
): ReviewCardFsrsState {
  const { card } = scheduler.next(toCard(state), now, GRADE_OF[rating]);
  return fromCard(card);
}
