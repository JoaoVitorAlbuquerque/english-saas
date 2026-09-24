import type { CefrLevel, ItemType } from '@english-saas/shared';

/**
 * O que o aluno pode ver de um item.
 *
 * O catálogo entrega a questão para o aluno responder, e o gabarito **não
 * pode ir junto** — nem `acceptedAnswers`, nem `correctOptionIds`, nem a
 * explicação, nem o mapa de erros. Quem corrige é o servidor (módulo 6).
 *
 * Função pura e com teste porque um vazamento aqui não dá erro em lugar
 * nenhum: a lição continua funcionando, só que com a resposta no HTML.
 */

export type AuthoredItem = {
  id: string;
  type: ItemType;
  prompt: string;
  content: unknown;
  cefrLevel: CefrLevel;
  skillIds: string[];
};

export type StudentItem = {
  id: string;
  type: ItemType;
  prompt: string;
  content: Record<string, unknown>;
  cefrLevel: CefrLevel;
  skillIds: string[];
};

/**
 * Campos de conteúdo que carregam o gabarito, por tipo.
 *
 * `audioText` é o texto que o TTS fala. Num ditado ele **é** a resposta, e
 * num item de escuta é a alternativa certa escrita por extenso — mandar
 * junto do áudio entregaria a questão de graça.
 */
const ANSWER_FIELDS: Partial<Record<ItemType, string[]>> = {
  MULTIPLE_CHOICE: ['correctOptionIds'],
  LISTEN_CHOOSE: ['correctOptionIds', 'audioText'],
  DICTATION: ['audioText'],
  READING_COMPREHENSION: ['correctOptionIds', 'passageTranslation'],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

/**
 * Tira do conteúdo o que entrega a resposta.
 *
 * MATCH é o caso especial: o par **é** o gabarito. Os dois lados vão
 * separados e o lado direito sai em ordem alfabética — mandar na ordem de
 * autoria entregaria a ligação de graça. Ordenar, e não embaralhar, porque
 * `domain/` não sorteia (CLAUDE.md); o embaralho visual é do front.
 */
export function stripAnswerKey(
  type: ItemType,
  content: unknown,
): Record<string, unknown> {
  const clone = asRecord(content);

  if (type === 'MATCH') {
    const pairs = Array.isArray(clone['pairs'])
      ? (clone['pairs'] as { left?: unknown; right?: unknown }[])
      : [];

    return {
      lefts: pairs.map((pair) => pair.left),
      rights: pairs
        .map((pair) => String(pair.right))
        .sort((a, b) => a.localeCompare(b)),
    };
  }

  for (const field of ANSWER_FIELDS[type] ?? []) {
    delete clone[field];
  }

  return clone;
}

/** Projeção do item para o aluno. */
export function toStudentItem(item: AuthoredItem): StudentItem {
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    content: stripAnswerKey(item.type, item.content),
    cefrLevel: item.cefrLevel,
    skillIds: item.skillIds,
  };
}
