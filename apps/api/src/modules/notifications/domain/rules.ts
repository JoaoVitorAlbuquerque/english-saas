/**
 * Regras de envio dos lembretes. Função pura: quem chama já leu se o aluno
 * estudou hoje, a agenda, as revisões vencidas e o histórico de envios.
 *
 * Limite de frequência: **um lembrete por dia** por aluno, somando o
 * diário e o de revisões acumuladas (a trava de verdade é o `dedupKey`
 * único do log; aqui a regra também recusa, para o teste dizer o porquê).
 */

/** Revisões vencidas a partir das quais vale avisar. */
export const BACKLOG_THRESHOLD = 25;
/** Intervalo mínimo entre dois avisos de revisões acumuladas. */
export const BACKLOG_INTERVAL_DAYS = 3;

export type ReminderType = 'DAILY_REMINDER' | 'REVIEW_BACKLOG';

export type SkipReason =
  | 'ALREADY_REMINDED_TODAY'
  | 'QUIET_HOURS'
  | 'NO_CHANNEL'
  | 'STUDIED_TODAY'
  | 'NOTHING_PLANNED'
  | 'DISABLED';

export type ReminderDecision =
  { send: true; type: ReminderType } | { send: false; reason: SkipReason };

export function chooseReminder(input: {
  prefs: { dailyReminder: boolean; reviewBacklog: boolean };
  hasChannel: boolean;
  quiet: boolean;
  alreadyRemindedToday: boolean;
  studiedToday: boolean;
  /** Minutos da agenda de hoje ainda não pulados. */
  pendingMinutes: number;
  dueCards: number;
  /** Dias desde o último aviso de revisões; `null` se nunca houve. */
  daysSinceLastBacklog: number | null;
}): ReminderDecision {
  if (input.alreadyRemindedToday) {
    return { send: false, reason: 'ALREADY_REMINDED_TODAY' };
  }
  if (!input.hasChannel) {
    return { send: false, reason: 'NO_CHANNEL' };
  }
  if (input.quiet) {
    return { send: false, reason: 'QUIET_HOURS' };
  }
  // Já estudou hoje: nada a lembrar — nem das revisões, que ele sabe onde estão.
  if (input.studiedToday) {
    return { send: false, reason: 'STUDIED_TODAY' };
  }

  const backlogDue =
    input.prefs.reviewBacklog &&
    input.dueCards >= BACKLOG_THRESHOLD &&
    (input.daysSinceLastBacklog === null ||
      input.daysSinceLastBacklog >= BACKLOG_INTERVAL_DAYS);

  if (backlogDue) {
    return { send: true, type: 'REVIEW_BACKLOG' };
  }

  if (!input.prefs.dailyReminder) {
    return { send: false, reason: 'DISABLED' };
  }

  if (input.pendingMinutes <= 0) {
    return { send: false, reason: 'NOTHING_PLANNED' };
  }

  return { send: true, type: 'DAILY_REMINDER' };
}

/** A chave que trava um lembrete por dia, qualquer que seja o tipo. */
export function reminderDedupKey(userId: string, localDate: string): string {
  return `reminder:${userId}:${localDate}`;
}

export function weeklyDedupKey(userId: string, weekStart: string): string {
  return `weekly:${userId}:${weekStart}`;
}
