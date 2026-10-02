/** Hoje (`YYYY-MM-DD`) no fuso do aluno — não no do navegador. */
export function todayInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Soma dias a uma data `YYYY-MM-DD` sem passar pelo fuso (conta em UTC). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/** `2027-03-01` → `01/03/2027`, por string: `new Date` deslocaria o dia pelo fuso. */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');

  return `${day}/${month}/${year}`;
}

/** Um instante (ISO) no fuso do aluno: `02/10/2026 10:00`. */
export function formatInstant(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(',', '');
}

/** `2048` → `2,0 KB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} ${units[unit]}`;
}
