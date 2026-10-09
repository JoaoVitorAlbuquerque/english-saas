import {
  availabilityMinutesSchema,
  interestSchema,
  learningGoalSchema,
  preferredStudyTimeSchema,
  roleSchema,
  selfReportedLevelSchema,
} from '@english-saas/shared';
import { z } from 'zod';

import { studyPlanSchema } from '../planner/schemas';

/**
 * Espelha `apps/api/src/modules/{users,admin}/controllers/admin-*.controller.ts`:
 * a busca de alunos e a ficha de um aluno para o painel (somente ADMIN).
 *
 * As seções da ficha (progresso, assinatura, créditos, histórico) têm o mesmo
 * formato das rotas `/me/*` e usam os schemas dos módulos `progress`,
 * `billing` e `learning`.
 */

function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

export const adminUserRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  emailVerifiedAt: z.string().nullable(),
  /** Conta excluída pelo aluno (carência da LGPD). */
  deletedAt: z.string().nullable(),
  /** Dados pessoais já apagados; nome e e-mail são anônimos. */
  anonymizedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminUserRow = z.infer<typeof adminUserRowSchema>;

export const adminUserPageSchema = paginated(adminUserRowSchema);
export type AdminUserPage = z.infer<typeof adminUserPageSchema>;

export const adminStudentProfileSchema = z.object({
  goals: z.array(learningGoalSchema),
  goalNote: z.string().nullable(),
  preferredStudyTime: preferredStudyTimeSchema,
  selfReportedLevel: selfReportedLevelSchema,
  timezone: z.string(),
  nativeLanguage: z.string(),
  targetDate: z.string().nullable(),
  availabilityMinutes: availabilityMinutesSchema,
});
export type AdminStudentProfile = z.infer<typeof adminStudentProfileSchema>;

export const adminStudentOverviewSchema = z.object({
  user: adminUserRowSchema,
  /** `null` até o aluno fazer o onboarding. */
  profile: adminStudentProfileSchema.nullable(),
  interests: z.array(interestSchema),
});
export type AdminStudentOverview = z.infer<typeof adminStudentOverviewSchema>;

/** `plan: null` = o aluno ainda não tem plano de estudos (estado normal). */
export const adminStudyPlanSchema = z.object({
  plan: studyPlanSchema.nullable(),
  pace: z
    .object({ weeksBehind: z.number(), message: z.string().nullable() })
    .nullable(),
});
export type AdminStudyPlan = z.infer<typeof adminStudyPlanSchema>;

const usageTotalsShape = {
  calls: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  /** Milionésimos de dólar. */
  costUsdMicros: z.number(),
};

export const adminAiUsageSchema = z.object({
  totals: z.object(usageTotalsShape),
  byFeature: z.array(z.object({ feature: z.string(), ...usageTotalsShape })),
});
export type AdminAiUsage = z.infer<typeof adminAiUsageSchema>;
