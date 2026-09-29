import type { ReviewAnswerResult, SessionCard } from '@english-saas/api-client';

export type ReviewPhase =
  'PICK_MINUTES' | 'LOADING' | 'IN_PROGRESS' | 'SUMMARY';

export type ReviewState = {
  phase: ReviewPhase;
  minutes: number | null;
  cards: SessionCard[];
  currentIndex: number;
  flipped: boolean;
  reviewedCount: number;
  /** `nextDueAt` de cada card respondido — o resumo agrupa por "quando volta". */
  dueDates: string[];
  error: string | null;
};

export const initialReviewState: ReviewState = {
  phase: 'PICK_MINUTES',
  minutes: null,
  cards: [],
  currentIndex: 0,
  flipped: false,
  reviewedCount: 0,
  dueDates: [],
  error: null,
};

export type ReviewAction =
  | { type: 'MINUTES_PICKED'; minutes: number }
  | { type: 'SESSION_LOADED'; cards: SessionCard[] }
  | { type: 'LOAD_FAILED'; message: string }
  | { type: 'CARD_FLIPPED' }
  | { type: 'ANSWER_RECEIVED'; result: ReviewAnswerResult }
  | { type: 'RESTARTED' };

export function reduceReview(
  state: ReviewState,
  action: ReviewAction,
): ReviewState {
  switch (action.type) {
    case 'MINUTES_PICKED':
      return {
        ...state,
        phase: 'LOADING',
        minutes: action.minutes,
        error: null,
      };

    case 'SESSION_LOADED':
      return {
        ...state,
        phase: action.cards.length === 0 ? 'SUMMARY' : 'IN_PROGRESS',
        cards: action.cards,
        currentIndex: 0,
        flipped: false,
      };

    case 'LOAD_FAILED':
      return { ...state, phase: 'PICK_MINUTES', error: action.message };

    case 'CARD_FLIPPED':
      return { ...state, flipped: true };

    case 'ANSWER_RECEIVED': {
      const nextIndex = state.currentIndex + 1;
      const finished = nextIndex >= state.cards.length;

      return {
        ...state,
        phase: finished ? 'SUMMARY' : 'IN_PROGRESS',
        currentIndex: nextIndex,
        flipped: false,
        reviewedCount: state.reviewedCount + 1,
        dueDates: [...state.dueDates, action.result.nextDueAt],
      };
    }

    case 'RESTARTED':
      return { ...initialReviewState };

    default:
      return state;
  }
}
