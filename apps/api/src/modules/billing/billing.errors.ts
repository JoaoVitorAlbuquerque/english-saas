import { HttpStatus } from '@nestjs/common';

import { AppException } from 'src/common/errors/app.exception';

/** Erros do billing. `code` em inglês, `message` em pt-BR. */

export class FeatureNotAvailableError extends AppException {
  constructor(feature: string, tier: string) {
    super(
      'FEATURE_NOT_AVAILABLE',
      'Esse recurso não faz parte do seu plano. Dá uma olhada nos planos para liberar.',
      HttpStatus.FORBIDDEN,
      { feature, tier },
    );
  }
}

export class InsufficientCreditsError extends AppException {
  constructor(feature: string, cost: number, balance: number) {
    super(
      'INSUFFICIENT_AI_CREDITS',
      'Seus créditos de IA deste mês acabaram. Eles voltam no próximo ciclo.',
      HttpStatus.PAYMENT_REQUIRED,
      { feature, cost, balance },
    );
  }
}

export class PlanNotAvailableError extends AppException {
  constructor() {
    super(
      'PLAN_NOT_AVAILABLE',
      'Esse plano não está disponível para assinatura.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class AlreadySubscribedError extends AppException {
  constructor(tier: string) {
    super(
      'ALREADY_SUBSCRIBED',
      'Você já tem uma assinatura ativa. Cancele a atual antes de assinar outra.',
      HttpStatus.CONFLICT,
      { tier },
    );
  }
}

export class NoActiveSubscriptionError extends AppException {
  constructor() {
    super(
      'NO_ACTIVE_SUBSCRIPTION',
      'Você não tem nenhuma assinatura ativa para cancelar.',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidWebhookError extends AppException {
  constructor(reason: 'token' | 'payload') {
    super(
      reason === 'token' ? 'INVALID_WEBHOOK_TOKEN' : 'INVALID_WEBHOOK_PAYLOAD',
      'Webhook recusado.',
      reason === 'token' ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_REQUEST,
    );
  }
}

/** O gateway não respondeu no request do checkout. */
export class PaymentUnavailableError extends AppException {
  constructor() {
    super(
      'PAYMENT_UNAVAILABLE',
      'Não conseguimos falar com o sistema de pagamento agora. Tenta de novo em alguns minutos.',
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/**
 * Falha falando com o gateway. Nunca chega ao aluno direto: acontece dentro
 * de job, que tenta de novo com backoff.
 */
export class PaymentGatewayError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}
