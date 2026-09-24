import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import basicAuth from 'express-basic-auth';

import { EnvModule } from 'src/common/config/env.module';
import { EnvService } from 'src/common/config/env.service';

import { QUEUES, REGISTERED_QUEUES } from '../queues';
import { registerQueue } from '../register-queue';
import { ExampleController } from '../example/example.controller';
import { ExampleQueueService } from '../example/example-queue.service';
import { ExampleProcessor } from '../example/example.processor';

export const QUEUE_ADMIN_ROUTE = 'admin/queues';

/**
 * Painel Bull Board em /admin/queues e o job de demonstração.
 *
 * A proteção é basic auth por variável de ambiente — suficiente enquanto não
 * existe autenticação (módulo 3). Quando o `auth` chegar, troque por um guard
 * de papel de administrador.
 */
@Module({
  imports: [
    registerQueue(QUEUES.EXAMPLE),
    BullBoardModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        route: `/${QUEUE_ADMIN_ROUTE}`,
        adapter: ExpressAdapter,
        middleware: basicAuth({
          challenge: true,
          realm: 'english-saas queues',
          users: {
            [envService.get('BULL_BOARD_USER')]: envService.get(
              'BULL_BOARD_PASSWORD',
            ),
          },
        }),
      }),
    }),
    ...REGISTERED_QUEUES.map((name) =>
      BullBoardModule.forFeature({ name, adapter: BullMQAdapter }),
    ),
  ],
  controllers: [ExampleController],
  providers: [ExampleQueueService, ExampleProcessor],
  exports: [ExampleQueueService],
})
export class QueueAdminModule implements NestModule {
  constructor(private readonly envService: EnvService) {}

  configure(consumer: MiddlewareConsumer): void {
    // O painel já recebe a basic auth pela opção `middleware` do Bull Board;
    // aqui protegemos o endpoint de demonstração com a mesma credencial.
    consumer
      .apply(
        basicAuth({
          challenge: true,
          realm: 'english-saas queues',
          users: {
            [this.envService.get('BULL_BOARD_USER')]: this.envService.get(
              'BULL_BOARD_PASSWORD',
            ),
          },
        }),
      )
      .forRoutes({ path: 'admin/example-jobs', method: RequestMethod.ALL });
  }
}
