import {
  hasTypedAnswer,
  stableStringify,
  type ItemType,
} from '@english-saas/shared';

import {
  blankContent,
  newRowKey,
  type ItemFormState,
  type Json,
  type MapRow,
} from './item-form';

/**
 * Ações do editor de item. O reducer é puro: o que muda no formulário, e só
 * isso — nada de rede, nada de tempo.
 */
export type ItemAction =
  | { type: 'reset'; state: ItemFormState }
  /** Campos simples: enunciado, explicação, nível, skills… */
  | { type: 'patch'; patch: Partial<Omit<ItemFormState, 'content' | 'type'>> }
  /** Troca o conteúdo inteiro do tipo atual. */
  | { type: 'content'; content: Json }
  /** Troca o tipo: o conteúdo começa em branco (o antigo não vale no novo). */
  | { type: 'setType'; itemType: ItemType }
  | { type: 'map/add' }
  | { type: 'map/set'; key: string; patch: Partial<Omit<MapRow, 'key'>> }
  | { type: 'map/remove'; key: string };

/**
 * Tipos que falam: o texto de `audioText` é o que o TTS sintetiza. O áudio
 * já gerado (`audioAssetId`) é daquele texto — mudou o texto, o áudio velho
 * seguiria ligado a uma fala que não existe mais, e o TTS só gera para
 * `null`.
 */
function dropStaleAudio(before: Json, after: Json): Json {
  if (
    'audioAssetId' in after &&
    before.audioText !== after.audioText &&
    after.audioAssetId !== null
  ) {
    return { ...after, audioAssetId: null };
  }

  return after;
}

export function itemReducer(
  state: ItemFormState,
  action: ItemAction,
): ItemFormState {
  switch (action.type) {
    case 'reset':
      return action.state;

    case 'patch':
      return { ...state, ...action.patch };

    case 'content':
      return {
        ...state,
        content: dropStaleAudio(state.content, action.content),
      };

    case 'setType': {
      if (action.itemType === state.type) {
        return state;
      }

      return {
        ...state,
        type: action.itemType,
        content: blankContent(action.itemType),
        acceptedAnswers: hasTypedAnswer(action.itemType) ? [''] : [],
        // O mapa de erros do tipo antigo não vale: as chaves eram o texto
        // das alternativas (ou das respostas) de lá.
        errorPatternMap: [],
      };
    }

    case 'map/add':
      return {
        ...state,
        errorPatternMap: [
          ...state.errorPatternMap,
          { key: newRowKey(), wrong: '', patternId: '' },
        ],
      };

    case 'map/set':
      return {
        ...state,
        errorPatternMap: state.errorPatternMap.map((row) =>
          row.key === action.key ? { ...row, ...action.patch } : row,
        ),
      };

    case 'map/remove':
      return {
        ...state,
        errorPatternMap: state.errorPatternMap.filter(
          (row) => row.key !== action.key,
        ),
      };
  }
}

/**
 * Já há algo escrito que trocar de tipo descartaria? Conteúdo diferente do
 * em branco do tipo, ou enunciado e respostas preenchidos.
 */
export function hasTypedContent(state: ItemFormState): boolean {
  return (
    state.prompt.trim() !== '' ||
    state.acceptedAnswers.some((answer) => answer.trim() !== '') ||
    stableStringify(state.content) !== stableStringify(blankContent(state.type))
  );
}
