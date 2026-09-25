import { timingSafeEqual } from 'node:crypto';

import type { NormalizedWebhookEvent } from '../domain/webhook';

export type GatewayPaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
export type GatewayCycle = 'MONTHLY' | 'YEARLY';

export type CreateCustomerInput = {
  userId: string;
  name: string;
  email: string;
  cpfCnpj?: string | undefined;
};

export type CreateSubscriptionInput = {
  customerId: string;
  /** Nosso id da assinatura — volta como `externalReference`. */
  reference: string;
  description: string;
  priceCents: number;
  cycle: GatewayCycle;
  paymentMethod: GatewayPaymentMethod;
  firstDueDate: Date;
  /** Abatido só da primeira cobrança (crédito proporcional de upgrade). */
  firstPaymentDiscountCents?: number | undefined;
};

export type WebhookHeaders = Record<string, string | string[] | undefined>;

/**
 * Contrato com o provedor de pagamento. Os módulos injetam esta classe
 * abstrata; a implementação (Asaas ou fake) é amarrada só no BillingModule.
 */
export abstract class PaymentGateway {
  abstract createCustomer(input: CreateCustomerInput): Promise<{ id: string }>;

  abstract createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<{ id: string }>;

  abstract cancelSubscription(subscriptionId: string): Promise<void>;

  /** Link da cobrança em aberto da assinatura — é onde o aluno paga. */
  abstract getCheckoutUrl(subscriptionId: string): Promise<string>;

  /**
   * Confere a autenticidade do webhook e traduz o corpo. `null` = token
   * inválido ou corpo que não é webhook; o controller recusa.
   */
  abstract parseWebhook(
    body: unknown,
    headers: WebhookHeaders,
  ):
    | { ok: true; event: NormalizedWebhookEvent }
    | { ok: false; reason: 'token' | 'payload' };
}

/** Header onde o Asaas manda o token combinado no painel. */
export const ASAAS_TOKEN_HEADER = 'asaas-access-token';

/** Comparação em tempo constante — não vaza o token por timing. */
export function tokenMatches(
  expected: string,
  received: string | string[] | undefined,
): boolean {
  if (typeof received !== 'string') {
    return false;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(received);

  return a.length === b.length && timingSafeEqual(a, b);
}
