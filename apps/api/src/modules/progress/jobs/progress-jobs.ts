/** A agregação da noite: os dois últimos dias, no fuso das métricas. */
export const AGGREGATE_DAILY_JOB = 'aggregate-daily';
/** Reprocessamento pedido pelo admin (backfill ou correção). */
export const AGGREGATE_RANGE_JOB = 'aggregate-range';

export type AggregateRangeJobData = { from: string; to: string };
