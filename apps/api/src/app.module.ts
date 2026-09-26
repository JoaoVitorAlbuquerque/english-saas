import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { AccessModule } from './common/access/access.module';
import { EnvModule } from './common/config/env.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { InfraModule } from './infra/infra.module';
import { AiModule } from './modules/ai/ai.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BillingAccessPolicy } from './modules/billing/services/billing-access.policy';
import { ContentStudioModule } from './modules/content-studio/content-studio.module';
import { ContentStudioGate } from './modules/content-studio/services/content-gate.service';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { LearnerModelModule } from './modules/learner-model/learner-model.module';
import { LearningModule } from './modules/learning/learning.module';
import { PlannerModule } from './modules/planner/planner.module';
import { SrsModule } from './modules/srs/srs.module';
import { GeneratorModule } from './modules/generator/generator.module';
import { ProgressModule } from './modules/progress/progress.module';
import { TutorModule } from './modules/tutor/tutor.module';
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
    // Quem trava (curriculum, learning) pergunta por token; quem decide
    // (billing, content-studio) é ligado só aqui. O que faltar nega tudo.
    AccessModule.forRoot({
      accessPolicy: {
        imports: [BillingModule],
        useExisting: BillingAccessPolicy,
      },
      contentGate: {
        imports: [ContentStudioModule],
        useExisting: ContentStudioGate,
      },
    }),

    HealthModule,
    AiModule,
    UsersModule,
    AuthModule,
    CurriculumModule,
    ContentStudioModule,
    LearningModule,
    LearnerModelModule,
    AssessmentModule,
    SrsModule,
    PlannerModule,
    BillingModule,
    TutorModule,
    GeneratorModule,
    ProgressModule,
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
