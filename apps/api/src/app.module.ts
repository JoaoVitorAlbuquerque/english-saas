import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { EnvModule } from './common/config/env.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { InfraModule } from './infra/infra.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Monólito modular. Cada módulo de negócio entra aqui na ordem da tabela
 * de módulos do CLAUDE.md — nenhum módulo importa outro fora dessa ordem.
 */
@Module({
  imports: [
    EnvModule,
    InfraModule,
    ScheduleModule.forRoot(),

    HealthModule,
    // 2 ai · 3 auth/users/onboarding · 4 curriculum · ... (ver CLAUDE.md)
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
