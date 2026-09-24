import type { Paginated } from '@english-saas/shared';

/**
 * Cursor opaco: o cliente só devolve o que recebeu.
 *
 * Guardamos base64url do id do último item. Opaco de propósito — o formato
 * pode mudar (ex.: virar `createdAt|id` numa ordenação composta) sem quebrar
 * o cliente.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');

  if (decoded.length === 0) {
    throw new Error('Cursor inválido.');
  }

  return decoded;
}

/**
 * Monta a resposta paginada a partir das linhas do banco.
 *
 * O chamador busca `limit + 1` linhas: a extra não vai para a resposta, só
 * diz que existe próxima página. Função pura — dá para testar sem banco.
 */
export function buildPage<T>(
  rows: T[],
  limit: number,
  getCursorValue: (row: T) => string,
): Paginated<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];

  return {
    data,
    hasMore,
    nextCursor:
      hasMore && last !== undefined ? encodeCursor(getCursorValue(last)) : null,
  };
}

/**
 * Traduz a query de paginação para os argumentos de cursor do Prisma.
 *
 *   const { take, ...cursorArgs } = toPrismaCursorArgs(query);
 *   prisma.lesson.findMany({ take, ...cursorArgs, orderBy: { id: 'asc' } });
 */
export function toPrismaCursorArgs(query: {
  cursor?: string | undefined;
  limit: number;
}): {
  take: number;
  cursor?: { id: string };
  skip?: number;
} {
  // +1 para descobrir se existe próxima página sem um count() extra.
  const take = query.limit + 1;

  if (query.cursor === undefined) {
    return { take };
  }

  // `skip: 1` pula o próprio item do cursor, que o cliente já recebeu.
  return { take, cursor: { id: decodeCursor(query.cursor) }, skip: 1 };
}
