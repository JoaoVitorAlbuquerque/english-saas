import type {
  AnswerResponse,
  AnswerVerdict,
  RegisterSwapDirection,
  Span,
} from '@english-saas/shared';

/**
 * Contrato dos componentes de item — puro, sem chamada de API.
 *
 * `content` de cada tipo já vem na forma que o aluno recebe do back-end
 * (`apps/api/.../curriculum/domain/student-view.ts`: `stripAnswerKey`),
 * com um ajuste: áudio chega como `audioUrl` já resolvido — a tela que
 * troca `audioAssetId` pela URL assinada (`AssetUrlService`), não este
 * componente.
 */

export type ItemMode = 'practice' | 'assessment' | 'preview';

export type OptionView = {
  id: string;
  text: string;
  translation?: string;
};

export type MultipleChoiceItemView = {
  id: string;
  type: 'MULTIPLE_CHOICE';
  prompt: string;
  content: { options: OptionView[]; shuffle: boolean };
};

export type ListenChooseItemView = {
  id: string;
  type: 'LISTEN_CHOOSE';
  prompt: string;
  content: { options: OptionView[]; shuffle: boolean; audioUrl: string };
};

export type OrderWordsItemView = {
  id: string;
  type: 'ORDER_WORDS';
  prompt: string;
  content: { tokens: string[] };
};

export type FillBlankItemView = {
  id: string;
  type: 'FILL_BLANK';
  prompt: string;
  content: { sentence: string; hint?: string; choices?: string[] };
};

export type TypeAnswerItemView = {
  id: string;
  type: 'TYPE_ANSWER';
  prompt: string;
  content: { sourceText?: string; hint?: string };
};

export type MatchItemView = {
  id: string;
  type: 'MATCH';
  prompt: string;
  content: { lefts: string[]; rights: string[] };
};

export type DictationItemView = {
  id: string;
  type: 'DICTATION';
  prompt: string;
  content: { audioUrl: string; maxPlays: number };
};

export type ReadingComprehensionItemView = {
  id: string;
  type: 'READING_COMPREHENSION';
  prompt: string;
  content: {
    passage: string;
    spans: Span[];
    options: OptionView[];
    shuffle: boolean;
  };
};

export type RegisterSwapItemView = {
  id: string;
  type: 'REGISTER_SWAP';
  prompt: string;
  content: { source: string; direction: RegisterSwapDirection };
};

export type ItemView =
  | MultipleChoiceItemView
  | ListenChooseItemView
  | OrderWordsItemView
  | FillBlankItemView
  | TypeAnswerItemView
  | MatchItemView
  | DictationItemView
  | ReadingComprehensionItemView
  | RegisterSwapItemView;

/** Mesma forma de `AnswerResult.correctAnswer` (`answer.service.ts`). */
export type CorrectAnswerView =
  | { optionIds: string[]; texts: string[] }
  | { text: string }
  | { pairs: { left: string; right: string }[] };

export type ItemErrorPattern = {
  id: string;
  description: string;
  correction: string;
  explanation: string;
};

/** Mesma forma de `AnswerResult` (`answer.service.ts`), menos `answerId`/`isFirstTry`. */
export type ItemFeedback = {
  isCorrect: boolean;
  score: number;
  verdict: AnswerVerdict;
  feedback: string;
  explanation: string;
  correctAnswer: CorrectAnswerView;
  errorPatterns?: ItemErrorPattern[];
};

export type ItemAnswerPayload = {
  response: AnswerResponse;
  responseTimeMs: number;
  hintsUsed: number;
};

export type ItemTypeProps<TItem extends ItemView> = {
  item: TItem;
  mode: ItemMode;
  onAnswer?: (payload: ItemAnswerPayload) => void;
  feedback?: ItemFeedback | null;
  disabled?: boolean;
};
