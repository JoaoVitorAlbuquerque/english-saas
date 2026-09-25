import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';

import { IsPublic } from 'src/common/decorators/is-public.decorator';
import { QUEUES } from 'src/infra/queue/queues';

import { InvalidWebhookError } from '../billing.errors';
import {
  PROCESS_WEBHOOK_JOB,
  type ProcessWebhookJobData,
} from '../jobs/billing-jobs';
import {
  PaymentGateway,
  type WebhookHeaders,
} from '../services/payment-gateway';

/**
 * Recebe o webhook do Asaas. Autentica, normaliza e enfileira — responde
 * rápido para o Asaas não reenviar por timeout. Sem autenticação JWT e sem
 * rate limit: quem prova a origem é o token do header.
 */
@ApiExcludeController()
@IsPublic()
@SkipThrottle()
@Controller('webhooks')
export class AsaasWebhookController {
  constructor(
    private readonly gateway: PaymentGateway,
    @InjectQueue(QUEUES.BILLING) private readonly queue: Queue,
  ) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() body: unknown,
    @Headers() headers: WebhookHeaders,
  ): Promise<{ received: true }> {
    const parsed = this.gateway.parseWebhook(body, headers);

    if (!parsed.ok) {
      throw new InvalidWebhookError(parsed.reason);
    }

    const { event } = parsed;
    const data: ProcessWebhookJobData = {
      externalEventId: event.externalEventId,
      rawType: event.rawType,
      kind: event.kind,
      externalSubscriptionId: event.externalSubscriptionId,
      paymentDueDate: event.paymentDueDate?.toISOString() ?? null,
      payload: event.payload,
    };

    // jobId não aceita ":" e o id do Asaas pode ter qualquer coisa: hash.
    const jobKey = createHash('sha256')
      .update(event.externalEventId)
      .digest('hex');
    await this.queue.add(PROCESS_WEBHOOK_JOB, data, {
      jobId: `webhook-${jobKey.slice(0, 32)}`,
    });

    return { received: true };
  }
}
