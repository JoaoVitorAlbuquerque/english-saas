/**
 * As datas do painel chegam como `YYYY-MM-DD` já no fuso do aluno. Formatar
 * por string (sem `new Date`) evita o deslocamento de um dia que a conversão
 * por UTC causaria.
 */

/** `2026-09-28` → `28/09`. */
export function formatWeek(date: string): string {
  const [, month, day] = date.split('-');

  return `${day ?? ''}/${month ?? ''}`;
}

/** `2027-03-01` → `01/03/2027`. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-');

  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}
