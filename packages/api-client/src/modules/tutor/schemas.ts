import { z } from 'zod';

/**
 * Contratos do tutor (módulo 12). `result`/`turns[].feedback`/`summary` são
 * `unknown` no back-end (JSON de IA já sanitizado, sem schema Prisma) — aqui
 * viram `z.record`/`z.unknown` soltos, e a tela lê os campos que precisa com
 * o mesmo cuidado defensivo do `toItemView`.
 */

const CORRECTION_STATUSES = [
  'TRANSCRIBING',
  'QUEUED',
  'DONE',
  'REFUSED',
  'FAILED',
] as const;

export const correctionFixSchema = z.object({
  original: z.string(),
  suggestion: z.string(),
  explanationPtBr: z.string(),
  errorPatternId: z.string().nullable(),
  skillId: z.string().nullable(),
  severity: z.enum(['MINOR', 'MAJOR']),
});

export const correctionOutputSchema = z.object({
  safety: z.enum(['OK', 'INAPPROPRIATE']),
  corrected: z.string(),
  fixes: z.array(correctionFixSchema),
  rubric: z.array(
    z.object({ goalId: z.string(), met: z.boolean(), comment: z.string() }),
  ),
  registerTips: z.array(
    z.object({
      yourForm: z.string(),
      naturalSpokenForm: z.string(),
      standardForm: z.string(),
      note: z.string(),
    }),
  ),
  encouragement: z.string(),
  estimatedLevel: z.string(),
});
export type CorrectionOutput = z.infer<typeof correctionOutputSchema>;

export const correctionViewSchema = z.object({
  id: z.string(),
  status: z.enum(CORRECTION_STATUSES),
  message: z.string(),
  lessonId: z.string().nullable(),
  stepIndex: z.number().nullable(),
  source: z.enum(['TEXT', 'AUDIO']),
  text: z.string(),
  result: correctionOutputSchema.nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type CorrectionView = z.infer<typeof correctionViewSchema>;

export const createCorrectionRequestSchema = z.object({
  lessonId: z.string(),
  stepIndex: z.number().int().min(0),
  text: z.string().trim().min(1).max(2_000),
  clientRequestId: z.string().min(1).max(80).optional(),
});
export type CreateCorrectionRequest = z.infer<
  typeof createCorrectionRequestSchema
>;

const ROLEPLAY_STATUSES = ['ACTIVE', 'FINISHED'] as const;
const ROLEPLAY_TURN_STATUSES = ['DONE', 'PENDING', 'FAILED'] as const;

export const roleplayInlineCorrectionSchema = z.object({
  original: z.string(),
  suggestion: z.string(),
  explanationPtBr: z.string(),
  errorPatternId: z.string().nullable(),
});

export const roleplayTurnFeedbackSchema = z.object({
  safety: z.enum(['OK', 'OFF_TOPIC', 'INAPPROPRIATE']),
  goalsMet: z.array(z.string()),
  inlineCorrection: roleplayInlineCorrectionSchema.nullable(),
  spokenVsStandard: z
    .object({ spoken: z.string(), standard: z.string(), note: z.string() })
    .nullable(),
  helpPhrase: z.string().nullable(),
  expressionSkillIds: z.array(z.string()),
});
export type RoleplayTurnFeedback = z.infer<typeof roleplayTurnFeedbackSchema>;

export const roleplayTurnViewSchema = z.object({
  index: z.number(),
  role: z.enum(['STUDENT', 'CHARACTER']),
  text: z.string(),
  status: z.enum(ROLEPLAY_TURN_STATUSES),
  feedback: roleplayTurnFeedbackSchema.nullable(),
});
export type RoleplayTurnView = z.infer<typeof roleplayTurnViewSchema>;

export const roleplaySummarySchema = z.object({
  goals: z.array(
    z.object({ id: z.string(), description: z.string(), met: z.boolean() }),
  ),
  topCorrections: z.array(roleplayInlineCorrectionSchema),
  expressionSkillIds: z.array(z.string()),
  finishedBy: z.enum(['GOALS', 'TURNS', 'CHARACTER', 'STRIKES', 'STUDENT']),
});
export type RoleplaySummary = z.infer<typeof roleplaySummarySchema>;

export const roleplayViewSchema = z.object({
  id: z.string(),
  status: z.enum(ROLEPLAY_STATUSES),
  freeScenario: z.boolean(),
  scenario: z.string(),
  character: z.object({ name: z.string(), bio: z.string().nullable() }),
  goals: z.array(
    z.object({ id: z.string(), description: z.string(), met: z.boolean() }),
  ),
  maxTurns: z.number(),
  turnsLeft: z.number(),
  turns: z.array(roleplayTurnViewSchema),
  summary: roleplaySummarySchema.nullable(),
});
export type RoleplayView = z.infer<typeof roleplayViewSchema>;

export const startRoleplayRequestSchema = z.object({
  lessonId: z.string(),
  stepIndex: z.number().int().min(0),
});
export type StartRoleplayRequest = z.infer<typeof startRoleplayRequestSchema>;

export const roleplayTurnRequestSchema = z.object({
  text: z.string().trim().min(1).max(600),
  clientTurnId: z.string().min(1).max(80).optional(),
});
export type RoleplayTurnRequest = z.infer<typeof roleplayTurnRequestSchema>;
