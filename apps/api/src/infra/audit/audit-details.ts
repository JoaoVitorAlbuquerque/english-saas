/**
 * Só o que mudou, no formato que a auditoria guarda: `{campo: {from, to}}`.
 * Função pura — quem chama passa o "antes" lido antes de gravar.
 *
 * Compara por valor (`Object.is`): `0` e `false` contam como valores, e campo
 * ausente nos dois lados não entra.
 */
export type JsonPrimitive = string | number | boolean | null;
export type FieldChange = { from: JsonPrimitive; to: JsonPrimitive };

export function diffFields<T extends Record<string, JsonPrimitive>>(
  before: T,
  after: T,
  keys: readonly (keyof T & string)[],
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};

  for (const key of keys) {
    const from: JsonPrimitive = before[key] ?? null;
    const to: JsonPrimitive = after[key] ?? null;

    if (!Object.is(from, to)) {
      changes[key] = { from, to };
    }
  }

  return changes;
}
