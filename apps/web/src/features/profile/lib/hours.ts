/**
 * A hora cai no silencioso? Espelha `isQuietHour` do back-end
 * (`notifications/domain/schedule.ts`): janela `[start, end)`, que pode
 * atravessar a meia-noite (22 → 8); `start === end` é "sem silencioso".
 * Serve só para avisar antes do request — quem recusa de verdade é a API.
 */
export function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) {
    return false;
  }

  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}

export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** `19` → `19h`. */
export function formatHour(hour: number): string {
  return `${hour}h`;
}
