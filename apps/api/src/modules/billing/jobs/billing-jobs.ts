/** Abre a assinatura no gateway e busca o link de pagamento. */
export const CREATE_CHECKOUT_JOB = 'create-checkout';
/** Cancela no gateway o que o aluno já cancelou aqui. */
export const CANCEL_AT_GATEWAY_JOB = 'cancel-at-gateway';
/** Aplica um webhook do Asaas. */
export const PROCESS_WEBHOOK_JOB = 'process-webhook';
/** Crédito do mês de um aluno. */
export const GRANT_CREDITS_JOB = 'grant-credits';
/** Dia 1º: enfileira o crédito do mês de cada aluno. */
export const MONTHLY_GRANT_TICK_JOB = 'monthly-grant-tick';
/** Diário: alerta interno de custo de IA por aluno. */
export const COST_ALERT_TICK_JOB = 'cost-alert-tick';

/** Só o id: dado pessoal (CPF) nunca entra em job — ficaria no Bull Board. */
export type CreateCheckoutJobData = { subscriptionId: string };
export type CancelAtGatewayJobData = { asaasSubscriptionId: string };
/** O evento já autenticado e normalizado pelo controller; data em ISO. */
export type ProcessWebhookJobData = {
  externalEventId: string;
  rawType: string;
  kind: string | null;
  externalSubscriptionId: string | null;
  paymentDueDate: string | null;
  payload: unknown;
};
export type GrantCreditsJobData = { userId: string };
