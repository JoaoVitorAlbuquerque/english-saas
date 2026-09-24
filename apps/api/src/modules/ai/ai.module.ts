import { Logger, Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

import { EnvService } from 'src/common/config/env.service';
import { adminBasicAuth } from 'src/common/middleware/admin-basic-auth.middleware';

import { AiAdminController } from './controllers/ai-admin.controller';
import { AiCacheService } from './services/ai-cache.service';
import { AiPricingService } from './services/ai-pricing.service';
import { AiService } from './services/ai.service';
import { AiUsageService } from './services/ai-usage.service';
import { FakeLlmProvider } from './services/fake-llm.provider';
import { LlmProvider } from './services/llm.provider';
import { OpenAiProvider } from './services/openai.provider';

/**
 * Decide qual provedor entra.
 *
 * `auto` cai no fake em NODE_ENV=test ou quando não há OPENAI_API_KEY — assim
 * o ambiente local sobe sem crédito e os testes rodam sem rede. Em produção,
 * defina `AI_PROVIDER=openai` para que a falta da chave seja um erro visível
 * em vez de um fake silencioso.
 */
function resolveProvider(
  envService: EnvService,
  openAi: OpenAiProvider,
  fake: FakeLlmProvider,
): LlmProvider {
  const choice = envService.get('AI_PROVIDER');

  if (choice === 'fake') {
    return fake;
  }

  if (choice === 'openai') {
    return openAi;
  }

  if (envService.isTest) {
    return fake;
  }

  if (envService.get('OPENAI_API_KEY') === undefined) {
    new Logger('AiModule').warn(
      'OPENAI_API_KEY ausente — o módulo ai vai responder com o provider fake',
    );
    return fake;
  }

  return openAi;
}

/**
 * Módulo 2 — ai.
 *
 * Usado por content-studio (5), tutor (12) e generator (13). **Nenhum outro
 * módulo fala com o SDK da OpenAI direto**: todos passam pelo `AiService`.
 */
@Module({
  controllers: [AiAdminController],
  providers: [
    OpenAiProvider,
    FakeLlmProvider,
    {
      provide: LlmProvider,
      inject: [EnvService, OpenAiProvider, FakeLlmProvider],
      useFactory: resolveProvider,
    },
    AiPricingService,
    AiCacheService,
    AiUsageService,
    AiService,
  ],
  exports: [AiService, AiUsageService, AiCacheService, LlmProvider],
})
export class AiModule implements NestModule {
  constructor(private readonly envService: EnvService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(adminBasicAuth(this.envService))
      .forRoutes({ path: 'admin/ai/*path', method: RequestMethod.ALL });
  }
}
