/** Tick de um fuso, a cada hora cheia local. */
export const TIMEZONE_TICK_JOB = 'timezone-tick';
/** O lembrete do dia de um aluno. */
export const REMINDER_JOB = 'reminder';
/** O resumo da semana anterior de um aluno. */
export const WEEKLY_SUMMARY_JOB = 'weekly-summary';

export type TimezoneTickJobData = { timezone: string };

/** Só ids e datas: nada de dado pessoal na fila. */
export type UserNotificationJobData = {
  userId: string;
  timezone: string;
  /** Dia local do aluno em que o tick disparou. */
  localDate: string;
  /** Instante do tick (ISO) — o retry decide com o mesmo relógio. */
  at: string;
};
