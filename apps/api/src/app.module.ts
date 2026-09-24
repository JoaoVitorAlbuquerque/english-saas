import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { EnvModule } from './common/config/env.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { InfraModule } from './infra/infra.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentStudioModule } from './modules/content-studio/content-studio.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

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
    AiModule,
    UsersModule,
    AuthModule,
    CurriculumModule,
    ContentStudioModule,
    // 6 learning · 7 learner-model · ... (ver CLAUDE.md)
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // A ordem importa: o JwtAuthGuard preenche request.user, que o
    // RolesGuard lê logo em seguida.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
