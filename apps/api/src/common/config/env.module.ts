import { join } from 'node:path';

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './env';
import { EnvService } from './env.service';

/** O `.env` fica na raiz do monorepo e é compartilhado pelos apps. */
const ROOT_ENV_FILE = join(__dirname, '..', '..', '..', '..', '..', '.env');

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [ROOT_ENV_FILE, '.env'],
      validate: validateEnv,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
