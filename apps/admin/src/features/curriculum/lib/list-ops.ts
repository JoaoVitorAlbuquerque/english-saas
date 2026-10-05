/**
 * Operações puras sobre listas — as que os editores repetem em toda lista
 * reordenável (etapas, falas, cards, itens da prática, metas).
 */

export function replaceAt<T>(list: readonly T[], index: number, value: T): T[] {
  return list.map((entry, position) => (position === index ? value : entry));
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, position) => position !== index);
}

export function insertAt<T>(list: readonly T[], index: number, value: T): T[] {
  const next = [...list];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, value);

  return next;
}

/** Troca de lugar com o vizinho; nas pontas, devolve a lista como estava. */
export function moveItem<T>(
  list: readonly T[],
  index: number,
  delta: -1 | 1,
): T[] {
  const target = index + delta;

  if (
    index < 0 ||
    index >= list.length ||
    target < 0 ||
    target >= list.length
  ) {
    return [...list];
  }

  const next = [...list];
  const moved = next[index] as T;
  next[index] = next[target] as T;
  next[target] = moved;

  return next;
}

/** `value` vazio tira a chave: campo opcional vazio não vai para o servidor. */
export function withOptional<T extends object, K extends string>(
  object: T,
  key: K,
  value: string | number | undefined,
): T {
  const next: Record<string, unknown> = {
    ...(object as Record<string, unknown>),
  };

  if (value === undefined || value === '') {
    delete next[key];
  } else {
    next[key] = value;
  }

  return next as T;
}
