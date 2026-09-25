import { Logger, Module } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { AiModule } from 'src/modules/ai/ai.module';
import { UsersModule } from 'src/modules/users/users.module';

import { AdminBillingController } from './controllers/admin-billing.controller';
import { AsaasWebhookController } from './controllers/asaas-webhook.controller';
import { BillingController } from './controllers/billing.controller';
import { RequiresFeatureGuard } from './guards/requires-feature.guard';
import { BillingListener } from './jobs/billing.listener';
import { BillingProcessor } from './jobs/billing.processor';
import { BillingScheduler } from './jobs/billing.scheduler';
import { AiCreditService } from './services/ai-credit.service';
import { AsaasGateway } from './services/asaas-gateway.service';
import { EntitlementsService } from './services/entitlements.service';
import { FakePaymentGateway } from './services/fake-payment-gateway.service';
import { PaymentGateway } from './services/payment-gateway';
import { PlansService } from './services/plans.service';
import { SubscriptionService } from './services/subscription.service';

/**
 * Mesma regra do provedor de IA: `auto` cai no fake em teste ou sem
 * ASAAS_API_KEY; em produção, `PAYMENT_PROVIDER=asaas` faz a falta da chave
 * virar erro visível em vez de um fake silencioso.
 */
function resolveGateway(
  envService: EnvService,
  asaas: AsaasGateway,
  fake: FakePaymentGateway,
): PaymentGateway {
  const choice = envService.get('PAYMENT_PROVIDER');

  if (choice === 'fake') {
    return fake;
  }

  if (choice === 'asaas') {
    return asaas;
  }

  if (envService.isTest) {
    return fake;
  }

  if (!envService.has('ASAAS_API_KEY')) {
    new Logger('BillingModule').warn(
      'ASAAS_API_KEY ausente — o billing vai usar o gateway de pagamento fake',
    );
    return fake;
  }

  return asaas;
}

/**
 * Módulo 11 — billing.
 *
 * Planos (config em banco), assinatura no Asaas atrás de `PaymentGateway`,
 * direitos por plano (`EntitlementsService`, `@RequiresFeature`) e o
 * livro-caixa de créditos de IA (`AiCreditService`). O tutor (12) e o
 * generator (13) usam os três exportados daqui.
 *
 * Escuta `user.registered` (crédito do mês) e `user.deletion_requested`
 * (cancela a cobrança) pela fila `billing`.
 */
@Module({
  imports: [AiModule, UsersModule, registerQueue(QUEUES.BILLING)],
  controllers: [
    BillingController,
    AsaasWebhookController,
    AdminBillingController,
  ],
  providers: [
    AsaasGateway,
    FakePaymentGateway,
    {
      provide: PaymentGateway,
      inject: [EnvService, AsaasGateway, FakePaymentGateway],
      useFactory: resolveGateway,
    },
    PlansService,
    AiCreditService,
    EntitlementsService,
    SubscriptionService,
    RequiresFeatureGuard,
    BillingListener,
    BillingProcessor,
    BillingScheduler,
  ],
  exports: [EntitlementsService, AiCreditService, RequiresFeatureGuard],
})
export class BillingModule {}
