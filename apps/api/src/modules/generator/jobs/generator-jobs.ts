/**
 * Jobs da fila `generator`. Os dados levam só o id do pedido: o texto que o
 * aluno colou fica na linha (e é apagado no fim), nunca no Redis nem no
 * Bull Board.
 */

export const SUGGEST_JOB = 'suggest';
export const TOPIC_JOB = 'topic';
export const INGEST_JOB = 'ingest';

export type GenerationJobData = { generationJobId: string };
