import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { PaymentEventKind } from './subscription-state';

/** Evento do gateway já no nosso vocabulário. `kind` nulo = não nos interessa. */
export type NormalizedWebhookEvent = {
  externalEventId: string;
  rawType: string;
  kind: PaymentEventKind | null;
  externalSubscriptionId: string | null;
  paymentDueDate: Date | null;
  payload: unknown;
};

const EVENT_KINDS: Record<string, PaymentEventKind> = {
  // Cartão confirma; Pix e boleto chegam como "recebido". Os dois pagam.
  PAYMENT_CONFIRMED: 'PAYMENT_PAID',
  PAYMENT_RECEIVED: 'PAYMENT_PAID',
  PAYMENT_OVERDUE: 'PAYMENT_OVERDUE',
  SUBSCRIPTION_DELETED: 'SUBSCRIPTION_ENDED',
  SUBSCRIPTION_INACTIVATED: 'SUBSCRIPTION_ENDED',
};

const asaasWebhookSchema = z.looseObject({
  id: z.string().min(1).optional(),
  event: z.string().min(1),
  payment: z
    .looseObject({
      id: z.string().optional(),
      subscription: z.string().nullish(),
      dueDate: z.string().nullish(),
    })
    .nullish(),
  subscription: z.looseObject({ id: z.string().optional() }).nullish(),
});

const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Traduz o corpo de um webhook do Asaas. Devolve `null` se o formato não é
 * de webhook — o chamador responde 400 em vez de enfileirar lixo.
 *
 * O Asaas manda um `id` único por evento; sem ele, o id vira o hash do
 * corpo, o que ainda deduplica a reentrega idêntica.
 */
export function parseAsaasWebhook(
  body: unknown,
): NormalizedWebhookEvent | null {
  const parsed = asaasWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;
  const dueDate = data.payment?.dueDate;

  return {
    externalEventId:
      data.id ??
      createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    rawType: data.event,
    kind: EVENT_KINDS[data.event] ?? null,
    externalSubscriptionId:
      data.payment?.subscription ?? data.subscription?.id ?? null,
    paymentDueDate:
      typeof dueDate === 'string' && DUE_DATE.test(dueDate)
        ? new Date(`${dueDate}T00:00:00.000Z`)
        : null,
    payload: body,
  };
}
