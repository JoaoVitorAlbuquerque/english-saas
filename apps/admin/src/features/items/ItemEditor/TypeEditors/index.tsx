import type { ItemType } from '@english-saas/shared';
import type { ComponentType } from 'react';

import { ChoiceEditor } from './ChoiceEditor';
import { DictationEditor } from './DictationEditor';
import { FillBlankEditor } from './FillBlankEditor';
import { ListenChooseEditor } from './ListenChooseEditor';
import { MatchEditor } from './MatchEditor';
import { OrderWordsEditor } from './OrderWordsEditor';
import { ReadingEditor } from './ReadingEditor';
import { RegisterSwapEditor } from './RegisterSwapEditor';
import { TypeAnswerEditor } from './TypeAnswerEditor';
import type { TypeEditorProps } from './types';

export type { TypeEditorProps } from './types';

const EDITORS: Record<ItemType, ComponentType<TypeEditorProps>> = {
  MULTIPLE_CHOICE: ChoiceEditor,
  LISTEN_CHOOSE: ListenChooseEditor,
  ORDER_WORDS: OrderWordsEditor,
  FILL_BLANK: FillBlankEditor,
  TYPE_ANSWER: TypeAnswerEditor,
  MATCH: MatchEditor,
  DICTATION: DictationEditor,
  READING_COMPREHENSION: ReadingEditor,
  REGISTER_SWAP: RegisterSwapEditor,
};

/** O editor do conteúdo de cada tipo de item. */
export function TypeEditor({
  type,
  ...props
}: TypeEditorProps & { type: ItemType }) {
  const Editor = EDITORS[type];

  return <Editor {...props} />;
}
