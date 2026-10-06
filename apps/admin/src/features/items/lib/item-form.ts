import type {
  AdminItem,
  CreateItemRequest,
  UpdateItemRequest,
} from '@english-saas/api-client';
import {
  hasTypedAnswer,
  stableStringify,
  type CefrLevel,
  type ItemType,
} from '@english-saas/shared';

/**
 * O formulário do item como o editor o mantém: tudo que é texto fica em texto
 * (inclusive dificuldade e discriminação), e o conteúdo é um objeto livre
 * conforme o tipo. Só na hora de salvar vira o corpo que a API espera.
 */

export type Json = Record<string, unknown>;

/** Uma linha do mapa de erros: "resposta errada" → erro típico. */
export type MapRow = {
  /** Identidade local da linha (não vai para a API). */
  key: string;
  wrong: string;
  patternId: string;
};

export type ItemFormState = {
  type: ItemType;
  /** Vazio = sem slug. Não muda depois de criado. */
  slug: string;
  prompt: string;
  content: Json;
  acceptedAnswers: string[];
  explanation: string;
  errorPatternMap: MapRow[];
  cefrLevel: CefrLevel;
  /** Vazio = o padrão do nível. */
  difficulty: string;
  /** Vazio = o padrão (1). */
  discrimination: string;
  skillIds: string[];
};

// ---------------------------------------------------------------------------
// Conteúdo em branco, por tipo
// ---------------------------------------------------------------------------

export const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

function blankOptions(): Json[] {
  return [
    { id: 'a', text: '' },
    { id: 'b', text: '' },
  ];
}

export function blankContent(type: ItemType): Json {
  switch (type) {
    case 'MULTIPLE_CHOICE':
      return { options: blankOptions(), correctOptionIds: [], shuffle: true };
    case 'LISTEN_CHOOSE':
      return {
        options: blankOptions(),
        correctOptionIds: [],
        shuffle: true,
        audioText: '',
        audioAssetId: null,
      };
    case 'ORDER_WORDS':
      return { tokens: ['', ''] };
    case 'FILL_BLANK':
      return { sentence: '' };
    case 'TYPE_ANSWER':
      return {};
    case 'MATCH':
      return {
        pairs: [
          { left: '', right: '' },
          { left: '', right: '' },
        ],
      };
    case 'DICTATION':
      return { audioText: '', audioAssetId: null, maxPlays: 0 };
    case 'READING_COMPREHENSION':
      return {
        passage: '',
        spans: [],
        options: blankOptions(),
        correctOptionIds: [],
        shuffle: true,
      };
    case 'REGISTER_SWAP':
      return {
        source: '',
        direction: 'SPOKEN_TO_STANDARD',
        registerNoteId: '',
      };
  }
}

export function blankItemState(
  type: ItemType = 'MULTIPLE_CHOICE',
): ItemFormState {
  return {
    type,
    slug: '',
    prompt: '',
    content: blankContent(type),
    acceptedAnswers: hasTypedAnswer(type) ? [''] : [],
    explanation: '',
    errorPatternMap: [],
    cefrLevel: 'A1',
    difficulty: '',
    discrimination: '',
    skillIds: [],
  };
}

/** O próximo id livre de alternativa: a, b, c… */
export function nextOptionId(options: readonly { id: string }[]): string {
  const used = new Set(options.map((option) => option.id));

  return (
    OPTION_IDS.find((id) => !used.has(id)) ?? `o${String(options.length + 1)}`
  );
}

// ---------------------------------------------------------------------------
// Item do servidor → formulário
// ---------------------------------------------------------------------------

let rowCounter = 0;

export function newRowKey(): string {
  rowCounter += 1;

  return `row-${String(rowCounter)}`;
}

export function mapToRows(map: Record<string, string>): MapRow[] {
  return Object.entries(map).map(([wrong, patternId]) => ({
    key: newRowKey(),
    wrong,
    patternId,
  }));
}

export function itemToState(item: AdminItem): ItemFormState {
  return {
    type: item.type,
    slug: item.slug ?? '',
    prompt: item.prompt,
    content: structuredClone(item.content) as Json,
    acceptedAnswers: [...item.acceptedAnswers],
    explanation: item.explanation,
    errorPatternMap: mapToRows(item.errorPatternMap),
    cefrLevel: item.cefrLevel,
    difficulty: String(item.difficulty),
    discrimination: String(item.discrimination),
    skillIds: [...item.skillIds],
  };
}

// ---------------------------------------------------------------------------
// Formulário → corpo da API
// ---------------------------------------------------------------------------

/**
 * Tira do conteúdo o que é opcional e está vazio: `hint: ''` não é "sem
 * dica" para o servidor, é uma dica de zero letras. Campo obrigatório vazio
 * fica — é a validação que o aponta.
 */
export function cleanContent(type: ItemType, content: Json): Json {
  const clean: Json = { ...content };
  const drop = (key: string) => {
    if (clean[key] === '' || clean[key] === undefined) {
      delete clean[key];
    }
  };

  switch (type) {
    case 'TYPE_ANSWER':
      drop('sourceText');
      drop('hint');
      break;
    case 'FILL_BLANK':
      drop('hint');

      if (Array.isArray(clean.choices) && clean.choices.length === 0) {
        delete clean.choices;
      }

      break;
    case 'READING_COMPREHENSION':
      drop('passageTranslation');
      break;
    default:
      break;
  }

  if (Array.isArray(clean.options)) {
    clean.options = (clean.options as Json[]).map((option) => {
      const next = { ...option };

      if (next.translation === '' || next.translation === undefined) {
        delete next.translation;
      }

      return next;
    });
  }

  return clean;
}

/** `''` → `null`; número → número; o resto vira NaN (a validação aponta). */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');

  if (trimmed === '') {
    return null;
  }

  return Number(trimmed);
}

/** Só as linhas completas viram mapa; a incompleta é problema de validação. */
export function rowsToMap(rows: readonly MapRow[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (const row of rows) {
    if (row.wrong.trim() !== '' && row.patternId !== '') {
      map[row.wrong.trim()] = row.patternId;
    }
  }

  return map;
}

export function isRowIncomplete(row: MapRow): boolean {
  return (row.wrong.trim() === '') !== (row.patternId === '');
}

function acceptedFor(state: ItemFormState): string[] {
  return hasTypedAnswer(state.type) ? state.acceptedAnswers : [];
}

/** O corpo de `POST items`. */
export function toCreateRequest(state: ItemFormState): CreateItemRequest {
  const discrimination = parseNumber(state.discrimination);
  const slug = state.slug.trim();

  return {
    ...(slug === '' ? {} : { slug }),
    type: state.type,
    prompt: state.prompt,
    content: cleanContent(state.type, state.content),
    acceptedAnswers: acceptedFor(state),
    explanation: state.explanation,
    errorPatternMap: rowsToMap(state.errorPatternMap),
    cefrLevel: state.cefrLevel,
    difficulty: parseNumber(state.difficulty),
    ...(discrimination === null ? {} : { discrimination }),
    skillIds: state.skillIds,
  };
}

/** Os campos que continuam editáveis com o item publicado ou arquivado. */
export const EDITABLE_AFTER_PUBLISH = [
  'explanation',
  'errorPatternMap',
  'cefrLevel',
  'difficulty',
  'discrimination',
  'skillIds',
] as const;

/**
 * O corpo de `PATCH items/:id`: **só o que mudou** em relação ao item
 * salvo. Mandar `difficulty` junto sem ter mexido nela zeraria a dificuldade
 * calibrada; e mandar o enunciado de um item publicado, mesmo igual, é
 * pedir para a API conferir o que não deveria mudar.
 */
export function toPatch(
  state: ItemFormState,
  saved: ItemFormState,
  frozen: boolean,
): UpdateItemRequest {
  const next = toCreateRequest(state);
  const before = toCreateRequest(saved);
  const patch: Record<string, unknown> = {};
  const fields: readonly (keyof CreateItemRequest)[] = frozen
    ? EDITABLE_AFTER_PUBLISH
    : [
        'type',
        'prompt',
        'content',
        'acceptedAnswers',
        ...EDITABLE_AFTER_PUBLISH,
      ];

  for (const field of fields) {
    // Campo que ficou vazio e é opcional (discriminação) não vai: a API não
    // aceita `null` nele, e "vazio" aqui quer dizer "sem mudança".
    if (
      next[field] !== undefined &&
      stableStringify(next[field]) !== stableStringify(before[field])
    ) {
      patch[field] = next[field];
    }
  }

  return patch as UpdateItemRequest;
}

/** Para saber se há alteração não salva. */
export function snapshotOf(state: ItemFormState): string {
  const { errorPatternMap, ...rest } = state;

  return stableStringify({
    ...rest,
    // A identidade local da linha não conta como mudança.
    errorPatternMap: errorPatternMap.map(({ wrong, patternId }) => ({
      wrong,
      patternId,
    })),
  });
}
