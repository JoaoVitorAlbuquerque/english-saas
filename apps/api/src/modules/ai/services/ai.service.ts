import { Injectable, Logger } from '@nestjs/common';
import { AiCallStatus } from '@prisma/client';

import { EnvService } from 'src/common/config/env.service';

import {
  AiInputTooLargeError,
  AiProviderError,
  AiValidationError,
} from '../ai.errors';
import { UntrustedContentTooLargeError } from '../domain/untrusted';
import type { AiPrompt } from '../prompts/prompt';
import { AiCacheService } from './ai-cache.service';
import { AiPricingService } from './ai-pricing.service';
import { AiUsageService } from './ai-usage.service';
import { LlmProvider } from './llm.provider';

export type RunPromptOptions = {
  /** Aluno dono da chamada. Ausente em chamada de sistema. */
  userId?: string | undefined;
  /** Ignora o cache e força uma geração nova. */
  skipCache?: boolean;
};

export type RunPromptResult<TOutput> = {
  data: TOutput;
  cacheHit: boolean;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsdMicros: number;
    latencyMs: number;
    repairAttempts: number;
  };
};

/**
 * Porta de entrada do módulo de IA.
 *
 * **É o único jeito de os outros módulos chamarem IA.** Amarra num lugar só:
 * prompt versionado, limite de entrada, cache, validação zod, custo e
 * registro em `ai_usages`.
 *
 * Lembre que toda chamada aqui é lenta: quem usa roda dentro de um job
 * BullMQ, nunca segurando o request HTTP (ver CLAUDE.md).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly provider: LlmProvider,
    private readonly cache: AiCacheService,
    private readonly usage: AiUsageService,
    private readonly pricing: AiPricingService,
    private readonly envService: EnvService,
  ) {}

  async run<TContext, TOutput>(
    prompt: AiPrompt<TContext, TOutput>,
    context: TContext,
    options: RunPromptOptions = {},
  ): Promise<RunPromptResult<TOutput>> {
    const model = this.provider.resolveModel(prompt.tier);
    const lookup = {
      promptId: prompt.id,
      promptVersion: prompt.version,
      model,
      input: prompt.cacheInput?.(context) ?? context,
    };
    const cacheKey = this.cache.buildKey(lookup);
    const startedAt = Date.now();

    if (prompt.cacheTtlSeconds > 0 && options.skipCache !== true) {
      const cached = await this.cache.get<TOutput>(cacheKey);

      if (cached !== undefined) {
        await this.usage.record({
          userId: options.userId,
          feature: prompt.id,
          promptId: prompt.id,
          promptVersion: prompt.version,
          model,
          tier: prompt.tier,
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 0,
          latencyMs: Date.now() - startedAt,
          status: AiCallStatus.CACHE_HIT,
          cacheHit: true,
        });

        return {
          data: cached,
          cacheHit: true,
          usage: {
            model,
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 0,
            latencyMs: Date.now() - startedAt,
            repairAttempts: 0,
          },
        };
      }
    }

    const messages = this.buildMessages(prompt, context);

    try {
      const result = await this.provider.generateStructured({
        tier: prompt.tier,
        system: prompt.buildSystem(context),
        messages,
        schema: prompt.schema,
        schemaName: prompt.id.replace(/-/g, '_'),
        maxTokens: prompt.maxTokens,
        temperature: prompt.temperature,
        feature: prompt.id,
        ...(options.userId === undefined ? {} : { userId: options.userId }),
      });

      const costUsdMicros = this.pricing.computeCostUsdMicros(
        result.usage.model,
        result.usage,
      );

      await this.usage.record({
        userId: options.userId,
        feature: prompt.id,
        promptId: prompt.id,
        promptVersion: prompt.version,
        model: result.usage.model,
        tier: prompt.tier,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsdMicros,
        latencyMs: result.usage.latencyMs,
        status: AiCallStatus.OK,
        repairAttempts: result.usage.repairAttempts,
      });

      if (prompt.cacheTtlSeconds > 0) {
        await this.cache.set(
          cacheKey,
          lookup,
          result.data,
          prompt.cacheTtlSeconds,
        );
      }

      return {
        data: result.data,
        cacheHit: false,
        usage: { ...result.usage, costUsdMicros },
      };
    } catch (error) {
      await this.recordFailure(prompt, model, options.userId, startedAt, error);
      throw error;
    }
  }

  /**
   * Monta as mensagens do turno e impõe o teto de entrada da feature.
   *
   * O `wrapUntrusted` do prompt já pode recusar sozinho; aqui garantimos o
   * teto mesmo quando o prompt esquece de passar `maxChars`.
   */
  private buildMessages<TContext, TOutput>(
    prompt: AiPrompt<TContext, TOutput>,
    context: TContext,
  ): { role: 'user' | 'assistant'; content: string }[] {
    let messages;

    try {
      messages = prompt.buildUser(context);
    } catch (error) {
      if (error instanceof UntrustedContentTooLargeError) {
        throw new AiInputTooLargeError(error.limit, error.length);
      }

      throw error;
    }

    const limit =
      prompt.maxInputChars || this.envService.get('AI_MAX_INPUT_CHARS');
    const total = messages.reduce(
      (sum, message) => sum + message.content.length,
      0,
    );

    if (total > limit) {
      throw new AiInputTooLargeError(limit, total);
    }

    return messages;
  }

  private async recordFailure<TContext, TOutput>(
    prompt: AiPrompt<TContext, TOutput>,
    model: string,
    userId: string | undefined,
    startedAt: number,
    error: unknown,
  ): Promise<void> {
    const status =
      error instanceof AiValidationError
        ? AiCallStatus.VALIDATION_ERROR
        : AiCallStatus.PROVIDER_ERROR;

    const errorCode =
      error instanceof AiValidationError || error instanceof AiProviderError
        ? error.code
        : 'UNKNOWN';

    this.logger.warn(
      { feature: prompt.id, model, errorCode },
      'Chamada de IA falhou',
    );

    await this.usage.record({
      userId,
      feature: prompt.id,
      promptId: prompt.id,
      promptVersion: prompt.version,
      model,
      tier: prompt.tier,
      // Tokens perdidos numa falha não são reportados pelo SDK de forma
      // confiável; registramos 0 e o custo real aparece na fatura.
      inputTokens: 0,
      outputTokens: 0,
      costUsdMicros: 0,
      latencyMs: Date.now() - startedAt,
      status,
      errorCode,
    });
  }
}
