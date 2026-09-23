import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { EnvModule } from 'src/common/config/env.module';
import { EnvService } from 'src/common/config/env.service';

/**
 * Logs estruturados com pino. Todo log de request carrega `requestId`,
 * o mesmo id devolvido no corpo de erro da API.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        pinoHttp: {
          level: envService.get('LOG_LEVEL'),
          genReqId: (req: IncomingMessage) =>
            (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url === '/health',
          },
          // Nunca logue credencial, token ou conteúdo enviado pelo aluno.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.refreshToken',
            ],
            remove: true,
          },
          transport: envService.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'HH:MM:ss' },
              },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
