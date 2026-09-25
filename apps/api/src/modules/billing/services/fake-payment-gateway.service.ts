import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { parseAsaasWebhook } from '../domain/webhook';
import {
  ASAAS_TOKEN_HEADER,
  PaymentGateway,
  tokenMatches,
  type CreateCustomerInput,
  type CreateSubscriptionInput,
  type WebhookHeaders,
} from './payment-gateway';

/** Token aceito pelo fake quando `ASAAS_WEBHOOK_TOKEN` não está no env. */
export const FAKE_WEBHOOK_TOKEN = 'fake-asaas-webhook-token';

/**
 * Gateway em memória, para teste e para o ambiente local sem chave do
 * Asaas. Entende o mesmo formato de webhook do Asaas, então o teste
 * simula o pagamento mandando o corpo que o Asaas mandaria.
 */
@Injectable()
export class FakePaymentGateway extends PaymentGateway {
  private readonly logger = new Logger(FakePaymentGateway.name);
  private sequence = 0;
  readonly customers = new Map<string, CreateCustomerInput>();
  readonly subscriptions = new Map<string, CreateSubscriptionInput>();
  readonly canceled = new Set<string>();

  constructor(private readonly envService: EnvService) {
    super();
    this.logger.warn(
      'Usando o gateway de pagamento FAKE — nenhuma cobrança real será feita',
    );
  }

  async createCustomer(input: CreateCustomerInput): Promise<{ id: string }> {
    const id = `cus_fake_${String(++this.sequence)}`;
    this.customers.set(id, input);
    return Promise.resolve({ id });
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<{ id: string }> {
    const id = `sub_fake_${String(++this.sequence)}`;
    this.subscriptions.set(id, input);
    return Promise.resolve({ id });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    this.canceled.add(subscriptionId);
    return Promise.resolve();
  }

  async getCheckoutUrl(subscriptionId: string): Promise<string> {
    return Promise.resolve(`https://sandbox.asaas.fake/i/${subscriptionId}`);
  }

  parseWebhook(body: unknown, headers: WebhookHeaders) {
    const expected =
      this.envService.get('ASAAS_WEBHOOK_TOKEN') ?? FAKE_WEBHOOK_TOKEN;

    if (!tokenMatches(expected, headers[ASAAS_TOKEN_HEADER])) {
      return { ok: false as const, reason: 'token' as const };
    }

    const event = parseAsaasWebhook(body);

    return event === null
      ? { ok: false as const, reason: 'payload' as const }
      : { ok: true as const, event };
  }
}
