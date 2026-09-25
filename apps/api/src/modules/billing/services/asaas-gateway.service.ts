import { Injectable, Logger } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';

import { PaymentGatewayError } from '../billing.errors';
import { parseAsaasWebhook } from '../domain/webhook';
import {
  ASAAS_TOKEN_HEADER,
  PaymentGateway,
  tokenMatches,
  type CreateCustomerInput,
  type CreateSubscriptionInput,
  type WebhookHeaders,
} from './payment-gateway';

const REQUEST_TIMEOUT_MS = 15_000;

type AsaasPayment = { status?: string; invoiceUrl?: string };

/**
 * Cliente REST do Asaas (v3). Sem SDK oficial: só esta classe conhece a URL
 * e a chave. Nada do corpo (CPF, e-mail) vai para log — só rota e status.
 */
@Injectable()
export class AsaasGateway extends PaymentGateway {
  private readonly logger = new Logger(AsaasGateway.name);

  constructor(private readonly envService: EnvService) {
    super();
  }

  async createCustomer(input: CreateCustomerInput): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/customers', {
      name: input.name,
      email: input.email,
      ...(input.cpfCnpj === undefined ? {} : { cpfCnpj: input.cpfCnpj }),
      externalReference: input.userId,
      // Quem avisa o aluno somos nós; o e-mail do Asaas duplicaria.
      notificationDisabled: true,
    });
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/subscriptions', {
      customer: input.customerId,
      billingType: input.paymentMethod,
      value: input.priceCents / 100,
      nextDueDate: input.firstDueDate.toISOString().slice(0, 10),
      cycle: input.cycle,
      description: input.description,
      externalReference: input.reference,
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request(
      'DELETE',
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
  }

  async getCheckoutUrl(subscriptionId: string): Promise<string> {
    const page = await this.request<{ data?: AsaasPayment[] }>(
      'GET',
      `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
    );
    const payments = page.data ?? [];
    const open =
      payments.find((p) => p.status === 'PENDING' || p.status === 'OVERDUE') ??
      payments[0];

    if (open?.invoiceUrl === undefined) {
      throw new PaymentGatewayError(
        'no_invoice',
        'O Asaas ainda não gerou a cobrança desta assinatura.',
      );
    }

    return open.invoiceUrl;
  }

  parseWebhook(body: unknown, headers: WebhookHeaders) {
    const expected = this.envService.get('ASAAS_WEBHOOK_TOKEN');

    // Sem token configurado, recusa tudo: webhook aberto aceitaria qualquer
    // um dizendo "pagamento confirmado".
    if (
      expected === undefined ||
      !tokenMatches(expected, headers[ASAAS_TOKEN_HEADER])
    ) {
      return { ok: false as const, reason: 'token' as const };
    }

    const event = parseAsaasWebhook(body);

    return event === null
      ? { ok: false as const, reason: 'payload' as const }
      : { ok: true as const, event };
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const apiKey = this.envService.get('ASAAS_API_KEY');

    if (apiKey === undefined) {
      throw new PaymentGatewayError(
        'missing_api_key',
        'ASAAS_API_KEY não está configurada.',
      );
    }

    let response: Response;

    try {
      response = await fetch(
        `${this.envService.get('ASAAS_BASE_URL')}${path}`,
        {
          method,
          headers: {
            access_token: apiKey,
            'content-type': 'application/json',
            'user-agent': 'english-saas',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      this.logger.warn({ err: error, method, path }, 'Asaas inacessível');
      throw new PaymentGatewayError(
        'network',
        'Não foi possível falar com o Asaas.',
      );
    }

    if (!response.ok) {
      this.logger.warn(
        { method, path, status: response.status },
        'Asaas recusou',
      );
      throw new PaymentGatewayError(
        'http_error',
        `Asaas respondeu ${String(response.status)}.`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }
}
