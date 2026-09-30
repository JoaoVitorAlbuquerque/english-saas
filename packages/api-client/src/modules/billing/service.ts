import { apiFetch } from '../../http/fetch-client';
import {
  checkoutRequestSchema,
  creditsBalanceSchema,
  creditsHistoryPageSchema,
  planViewSchema,
  subscriptionOverviewSchema,
  type CheckoutRequest,
  type CreditsBalance,
  type CreditsHistoryPage,
  type PlanView,
  type SubscriptionOverview,
} from './schemas';

export async function getPlans(): Promise<PlanView[]> {
  return apiFetch('/plans', { schema: planViewSchema.array(), isPublic: true });
}

export async function checkout(
  input: CheckoutRequest,
): Promise<SubscriptionOverview> {
  const body = checkoutRequestSchema.parse(input);

  return apiFetch('/billing/checkout', {
    method: 'POST',
    body,
    schema: subscriptionOverviewSchema,
  });
}

export async function cancelSubscription(): Promise<SubscriptionOverview> {
  return apiFetch('/billing/cancel', {
    method: 'POST',
    schema: subscriptionOverviewSchema,
  });
}

export async function getSubscription(): Promise<SubscriptionOverview> {
  return apiFetch('/me/subscription', { schema: subscriptionOverviewSchema });
}

export async function getCredits(): Promise<CreditsBalance> {
  return apiFetch('/me/credits', { schema: creditsBalanceSchema });
}

export async function getCreditsHistory(
  query: {
    cursor?: string;
    limit?: number;
  } = {},
): Promise<CreditsHistoryPage> {
  const params = new URLSearchParams();
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();

  return apiFetch(`/me/credits/history${qs === '' ? '' : `?${qs}`}`, {
    schema: creditsHistoryPageSchema,
  });
}
