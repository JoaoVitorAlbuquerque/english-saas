import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { EnvService } from './common/config/env.service';
import { SWAGGER_ROUTE, setupSwagger } from './common/swagger/setup-swagger';
import { QUEUE_ADMIN_ROUTE } from './infra/queue/bull-board/queue-admin.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const envService = app.get(EnvService);
  const apiUrl = envService.get('API_URL');

  // O refresh token chega por cookie httpOnly.
  app.use(cookieParser());

  // `credentials: true` é o que deixa o browser mandar o cookie entre
  // app.exemplo.com.br e api.exemplo.com.br.
  app.enableCors({
    origin: [envService.get('WEB_URL')],
    credentials: true,
  });
  // Confia no proxy para `request.ip` valer o IP real do aluno.
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  setupSwagger(app, apiUrl);

  const port = envService.get('PORT');
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`API        http://localhost:${String(port)}`);
  logger.log(`Swagger    http://localhost:${String(port)}/${SWAGGER_ROUTE}`);
  logger.log(
    `Bull Board http://localhost:${String(port)}/${QUEUE_ADMIN_ROUTE}`,
  );
}

void bootstrap();
