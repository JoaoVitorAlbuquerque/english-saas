import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { EnvService } from './common/config/env.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const envService = app.get(EnvService);

  app.enableCors({
    origin: [envService.get('WEB_URL')],
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = envService.get('PORT');
  await app.listen(port, '0.0.0.0');

  app.get(Logger).log(`API ouvindo em http://localhost:${String(port)}`);
}

void bootstrap();
