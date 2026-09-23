import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './logger/logger.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

/**
 * Tudo que fala com o mundo externo: banco, Redis, filas, logs e (no módulo
 * 1) armazenamento S3. Nenhuma regra de negócio mora aqui.
 */
@Module({
  imports: [LoggerModule, DatabaseModule, RedisModule, QueueModule],
  exports: [LoggerModule, DatabaseModule, RedisModule, QueueModule],
})
export class InfraModule {}
