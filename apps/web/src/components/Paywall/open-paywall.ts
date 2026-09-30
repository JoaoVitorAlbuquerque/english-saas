import {
  ApiError,
  emitApiClientEvent,
  type RequiredPlan,
} from '@english-saas/api-client';

/**
 * Mesmo texto de `PlanRequiredError` (apps/api/src/common/access/access-policy.ts)
 * — usado quando o aluno clica num cadeado do catálogo, sem passar por uma
 * chamada de API que devolva o 403 de verdade.
 */
const REQUIRED_PLAN_MESSAGES: Record<RequiredPlan, string> = {
  PLUS: 'Esse conteúdo faz parte do plano Plus. Dá uma olhada nos planos para liberar.',
  BASE: 'Esse conteúdo faz parte dos planos pagos. Dá uma olhada nos planos para liberar.',
};

/** Abre o paywall global pelo mesmo canal de um 403 `PLAN_REQUIRED` real. */
export function openPaywall(requiredPlan: RequiredPlan): void {
  emitApiClientEvent({
    type: 'plan-required',
    requiredPlan,
    error: new ApiError({
      code: 'PLAN_REQUIRED',
      message: REQUIRED_PLAN_MESSAGES[requiredPlan],
      status: 403,
    }),
  });
}
