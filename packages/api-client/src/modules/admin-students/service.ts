import { apiFetch } from '../../http/fetch-client';
import { withQuery } from '../../http/with-query';
import {
  creditsBalanceSchema,
  creditsHistoryPageSchema,
  subscriptionOverviewSchema,
  type CreditsBalance,
  type CreditsHistoryPage,
  type SubscriptionOverview,
} from '../billing/schemas';
import {
  lessonHistoryPageSchema,
  type LessonHistoryPage,
} from '../learning/schemas';
import {
  studentProgressSchema,
  type StudentProgress,
} from '../progress/schemas';
import {
  adminAiUsageSchema,
  adminStudentOverviewSchema,
  adminStudyPlanSchema,
  adminUserPageSchema,
  type AdminAiUsage,
  type AdminStudentOverview,
  type AdminStudyPlan,
  type AdminUserPage,
} from './schemas';

const BASE = '/admin/users';

export type AdminUsersFilter = {
  q?: string;
  cursor?: string;
  limit?: number;
};

/** Busca por trecho do nome ou do e-mail; mais novo primeiro. */
export async function listUsers(
  filter: AdminUsersFilter = {},
): Promise<AdminUserPage> {
  return apiFetch(withQuery(BASE, filter), { schema: adminUserPageSchema });
}

/** Abrir a ficha deixa rastro na auditoria (é dado pessoal). */
export async function getStudent(id: string): Promise<AdminStudentOverview> {
  return apiFetch(`${BASE}/${id}`, { schema: adminStudentOverviewSchema });
}

export async function getStudentProgress(
  id: string,
  weeks: number,
): Promise<StudentProgress> {
  return apiFetch(withQuery(`${BASE}/${id}/progress`, { weeks }), {
    schema: studentProgressSchema,
  });
}

export async function getStudentPlan(id: string): Promise<AdminStudyPlan> {
  return apiFetch(`${BASE}/${id}/plan`, { schema: adminStudyPlanSchema });
}

export async function getStudentHistory(
  id: string,
  cursor?: string,
): Promise<LessonHistoryPage> {
  return apiFetch(withQuery(`${BASE}/${id}/history`, { cursor, limit: 20 }), {
    schema: lessonHistoryPageSchema,
  });
}

export async function getStudentSubscription(
  id: string,
): Promise<SubscriptionOverview> {
  return apiFetch(`${BASE}/${id}/subscription`, {
    schema: subscriptionOverviewSchema,
  });
}

export async function getStudentCredits(id: string): Promise<CreditsBalance> {
  return apiFetch(`${BASE}/${id}/credits`, { schema: creditsBalanceSchema });
}

export async function getStudentCreditHistory(
  id: string,
  cursor?: string,
): Promise<CreditsHistoryPage> {
  return apiFetch(
    withQuery(`${BASE}/${id}/credits/history`, { cursor, limit: 20 }),
    { schema: creditsHistoryPageSchema },
  );
}

export async function getStudentAiUsage(id: string): Promise<AdminAiUsage> {
  return apiFetch(`${BASE}/${id}/ai-usage`, { schema: adminAiUsageSchema });
}
