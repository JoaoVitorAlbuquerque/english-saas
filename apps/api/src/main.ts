import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { EnvService } from './common/config/env.service';
import { SWAGGER_ROUTE, setupSwagger } from './common/swagger/setup-swagger';
import { QUEUE_ADMIN_ROUTE } from './infra/queue/bull-board/queue-admin.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const envService = app.get(EnvService);
  const apiUrl = envService.get('API_URL');

  app.enableCors({
    origin: [envService.get('WEB_URL')],
    credentials: true,
  });
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
