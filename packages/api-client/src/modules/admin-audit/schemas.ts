import { AUDIT_ACTIONS, auditActionSchema } from '@english-saas/shared';
import { z } from 'zod';

/** Espelha `GET /admin/audit-log` (somente ADMIN). */

export { AUDIT_ACTIONS, auditActionSchema };
export type { AuditAction } from '@english-saas/shared';

export const auditEntrySchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorEmail: z.string(),
  /** Uma das `AUDIT_ACTIONS`; texto solto se o servidor ganhar uma ação nova. */
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  /** `{amount, reason}`, `{changes: {campo: {from, to}}}`… — depende da ação. */
  details: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
  createdAt: z.string(),
  /** E-mail de hoje do aluno alvo; `null` em alvo que não é aluno. */
  targetLabel: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditPageSchema = z.object({
  data: z.array(auditEntrySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type AuditPage = z.infer<typeof auditPageSchema>;
