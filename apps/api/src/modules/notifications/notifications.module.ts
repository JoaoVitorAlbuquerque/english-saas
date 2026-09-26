import { Logger, Module } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { QUEUES } from 'src/infra/queue/queues';
import { registerQueue } from 'src/infra/queue/register-queue';
import { LearningModule } from 'src/modules/learning/learning.module';
import { PlannerModule } from 'src/modules/planner/planner.module';
import { ProgressModule } from 'src/modules/progress/progress.module';
import { SrsModule } from 'src/modules/srs/srs.module';
import { UsersModule } from 'src/modules/users/users.module';

import {
  NotificationsController,
  UnsubscribeController,
} from './controllers/notifications.controller';
import { NotificationsListener } from './jobs/notifications.listener';
import { NotificationsProcessor } from './jobs/notifications.processor';
import { NotificationsScheduler } from './jobs/notifications.scheduler';
import {
  EmailChannel,
  NOTIFICATION_CHANNELS,
  WebPushChannel,
} from './services/channels';
import { NotificationSenderService } from './services/notification-sender.service';
import { PreferenceService } from './services/preference.service';
import { PushSubscriptionService } from './services/push-subscription.service';
import { ReminderService } from './services/reminder.service';
import { UnsubscribeService } from './services/unsubscribe.service';
import {
  FakeWebPushSender,
  VapidWebPushSender,
  WebPushSender,
} from './services/web-push-sender';

/**
 * `auto`: a biblioteca `web-push` com as chaves VAPID; em teste, o fake.
 * Sem as chaves, o sender real responde "indisponível" (`publicKey` nula) e
 * só o e-mail funciona.
 */
function resolvePushSender(
  env: EnvService,
  real: VapidWebPushSender,
  fake: FakeWebPushSender,
): WebPushSender {
  const choice = env.get('PUSH_PROVIDER');

  if (choice === 'fake' || (choice === 'auto' && env.isTest)) {
    return fake;
  }

  if (real.publicKey() === null) {
    new Logger('NotificationsModule').warn(
      'VAPID_PUBLIC_KEY ausente — Web Push indisponível, avisos só por e-mail',
    );
  }

  return real;
}

/**
 * Módulo 15 — notifications.
 *
 * Lembretes em cima do planner (10): o diário, o de revisões acumuladas e
 * o resumo semanal do progresso (14). E-mail é o canal padrão; Web Push é
 * opcional, por navegador. Dono de `notification_preferences`,
 * `push_subscriptions` e `notification_logs`.
 */
@Module({
  imports: [
    LearningModule,
    PlannerModule,
    ProgressModule,
    SrsModule,
    UsersModule,
    registerQueue(QUEUES.NOTIFICATIONS),
  ],
  controllers: [NotificationsController, UnsubscribeController],
  providers: [
    VapidWebPushSender,
    FakeWebPushSender,
    {
      provide: WebPushSender,
      inject: [EnvService, VapidWebPushSender, FakeWebPushSender],
      useFactory: resolvePushSender,
    },
    EmailChannel,
    WebPushChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      inject: [EmailChannel, WebPushChannel],
      useFactory: (email: EmailChannel, push: WebPushChannel) => [email, push],
    },
    NotificationSenderService,
    PreferenceService,
    PushSubscriptionService,
    ReminderService,
    UnsubscribeService,
    NotificationsProcessor,
    NotificationsScheduler,
    NotificationsListener,
  ],
})
export class NotificationsModule {}
