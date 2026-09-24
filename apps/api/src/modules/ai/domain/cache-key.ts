import { createHash } from 'node:crypto';

/**
 * Chave de cache de uma geração de IA.
 *
 * A chave precisa mudar sempre que a saída puder mudar: prompt, versão do
 * prompt, modelo e entrada. Se a versão do prompt subir, o cache antigo
 * simplesmente deixa de ser encontrado — nunca servimos resultado de um
 * prompt que não existe mais.
 */

export type AiCacheKeyInput = {
  promptId: string;
  promptVersion: number;
  model: string;
  /** Contexto que gerou a chamada, já normalizado pelo prompt. */
  input: unknown;
};

/**
 * Serializa de forma estável: chaves de objeto em ordem alfabética, para que
 * `{ a, b }` e `{ b, a }` produzam a mesma chave.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
    );

  return `{${entries.join(',')}}`;
}

/**
 * Normaliza texto antes de entrar na chave: espaços colapsados e bordas
 * aparadas. Assim duas colagens do mesmo texto com espaçamento diferente
 * reaproveitam o mesmo resultado.
 */
export function normalizeCacheInput(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim().replace(/\s+/g, ' ');
  }

  if (Array.isArray(value)) {
    return value.map(normalizeCacheInput);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeCacheInput(entry),
      ]),
    );
  }

  return value;
}

/** `ai:<promptId>:v<version>:<sha256 truncado>` */
export function buildAiCacheKey(input: AiCacheKeyInput): string {
  const fingerprint = stableStringify({
    model: input.model,
    input: normalizeCacheInput(input.input),
  });

  const digest = createHash('sha256').update(fingerprint).digest('hex');

  return `ai:${input.promptId}:v${String(input.promptVersion)}:${digest.slice(0, 32)}`;
}
