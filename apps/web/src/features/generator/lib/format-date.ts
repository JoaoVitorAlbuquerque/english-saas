/**
 * Data (e hora, se pedida) no fuso do aluno — o instante vem em UTC da API
 * (`nextGrantAt`, `createdAt`) e o dia muda conforme o fuso.
 */
export function formatInTimeZone(
  iso: string,
  timeZone: string | undefined,
  { withTime = false }: { withTime?: boolean } = {},
): string {
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    ...(timeZone ? { timeZone } : {}),
  };

  try {
    return new Intl.DateTimeFormat('pt-BR', options).format(date);
  } catch {
    // Fuso desconhecido pelo navegador: cai no fuso local.
    const { timeZone: _ignored, ...rest } = options;
    return new Intl.DateTimeFormat('pt-BR', rest).format(date);
  }
}
