import type { RegisterNote } from '@english-saas/shared';

import { DictationItem } from './DictationItem';
import { FillBlankItem } from './FillBlankItem';
import { ListenChooseItem } from './ListenChooseItem';
import { MatchItem } from './MatchItem';
import { MultipleChoiceItem } from './MultipleChoiceItem';
import { OrderWordsItem } from './OrderWordsItem';
import { ReadingComprehensionItem } from './ReadingComprehensionItem';
import { RegisterSwapItem } from './RegisterSwapItem';
import { TypeAnswerItem } from './TypeAnswerItem';
import type {
  ItemAnswerPayload,
  ItemFeedback,
  ItemMode,
  ItemView,
} from './types';

export type ItemRendererProps = {
  item: ItemView;
  mode: ItemMode;
  onAnswer?: (payload: ItemAnswerPayload) => void;
  feedback?: ItemFeedback | null;
  /** Só usado por REGISTER_SWAP, no painel de feedback. */
  registerNote?: RegisterNote;
  disabled?: boolean;
};

/**
 * Ponto único de entrada: player de lição, nivelamento, revisão, materiais
 * gerados e preview do admin renderizam questão chamando só isto.
 *
 * `assessment` nunca mostra o painel de feedback, mesmo que `feedback`
 * venha preenchido — o contrato do modo é "sem feedback, só avança".
 */
export function ItemRenderer({
  item,
  mode,
  onAnswer,
  feedback,
  registerNote,
  disabled,
}: ItemRendererProps) {
  const visibleFeedback = mode === 'assessment' ? undefined : feedback;

  switch (item.type) {
    case 'MULTIPLE_CHOICE':
      return (
        <MultipleChoiceItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'LISTEN_CHOOSE':
      return (
        <ListenChooseItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'ORDER_WORDS':
      return (
        <OrderWordsItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'FILL_BLANK':
      return (
        <FillBlankItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'TYPE_ANSWER':
      return (
        <TypeAnswerItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'MATCH':
      return (
        <MatchItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'DICTATION':
      return (
        <DictationItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'READING_COMPREHENSION':
      return (
        <ReadingComprehensionItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          disabled={disabled}
        />
      );
    case 'REGISTER_SWAP':
      return (
        <RegisterSwapItem
          item={item}
          mode={mode}
          onAnswer={onAnswer}
          feedback={visibleFeedback}
          registerNote={registerNote}
          disabled={disabled}
        />
      );
  }
}
