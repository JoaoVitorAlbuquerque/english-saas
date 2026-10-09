import { Module } from '@nestjs/common';

import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { LoggerModule } from './logger/logger.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { QueueAdminModule } from './queue/bull-board/queue-admin.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { ThrottlerModule } from './throttler/throttler.module';
import { TtsModule } from './tts/tts.module';

/**
 * Tudo que fala com o mundo externo: banco, Redis, filas, storage, logs,
 * eventos e rate limit. Nenhuma regra de negócio mora aqui.
 *
 * A ordem importa: RedisModule antes de QueueModule e ThrottlerModule, que
 * dependem da mesma conexão.
 */
@Module({
  imports: [
    LoggerModule,
    PrismaModule,
    AuditModule,
    RedisModule,
    QueueModule,
    QueueAdminModule,
    StorageModule,
    MailModule,
    TtsModule,
    EventsModule,
    ThrottlerModule,
  ],
  exports: [
    LoggerModule,
    PrismaModule,
    AuditModule,
    RedisModule,
    QueueModule,
    StorageModule,
    MailModule,
    TtsModule,
    EventsModule,
    ThrottlerModule,
  ],
})
export class InfraModule {}
