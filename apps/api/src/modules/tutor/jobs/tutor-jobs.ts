/** Transcreve o áudio de uma correção (voz, atrás de flag). */
export const TRANSCRIBE_JOB = 'transcribe';
/** Corrige uma produção livre. */
export const CORRECT_JOB = 'correct';
/** Gera a fala do personagem num turno de roleplay. */
export const ROLEPLAY_TURN_JOB = 'roleplay-turn';

// Só ids: o texto do aluno fica no banco, não nos dados do job.
export type CorrectionJobData = { correctionId: string };
export type RoleplayTurnJobData = { turnId: string };
