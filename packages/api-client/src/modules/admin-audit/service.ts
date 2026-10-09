import { apiFetch } from '../../http/fetch-client';
import { withQuery } from '../../http/with-query';
import { auditPageSchema, type AuditPage } from './schemas';

export type AuditFilter = {
  action?: string;
  actorId?: string;
  targetId?: string;
  /** Instantes ISO (os limites do dia no fuso de quem olha). */
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export async function listAuditLog(
  filter: AuditFilter = {},
): Promise<AuditPage> {
  return apiFetch(withQuery('/admin/audit-log', filter), {
    schema: auditPageSchema,
  });
}
