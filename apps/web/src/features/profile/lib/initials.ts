/**
 * Iniciais para o avatar (ainda não há foto): primeira letra do primeiro e do
 * último nome. "Maria da Silva" → "MS", "Maria" → "M", vazio → "?".
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];

  if (first === undefined || last === undefined) {
    return '?';
  }

  const letter = (word: string) =>
    (Array.from(word)[0] ?? '').toLocaleUpperCase('pt-BR');

  return words.length === 1 ? letter(first) : `${letter(first)}${letter(last)}`;
}
