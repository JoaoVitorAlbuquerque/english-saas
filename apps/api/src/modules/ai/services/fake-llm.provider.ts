import { Injectable, Logger } from '@nestjs/common';
import { ZodError } from 'zod';

import { EnvService } from 'src/common/config/env.service';

import { AiValidationError } from '../ai.errors';
import { AI_FIXTURES, type AiFixture } from '../prompts/fixtures';
import {
  LlmProvider,
  type GenerateStructuredInput,
  type GenerateTextInput,
  type LlmResult,
  type LlmTier,
} from './llm.provider';

/**
 * Provedor falso, para teste e para o ambiente local sem chave da OpenAI.
 *
 * Devolve a fixture registrada para a feature. Os testes conseguem trocar a
 * fixture em tempo de execução com `setFixture`, o que permite exercitar o
 * caminho de validação quebrada sem gastar token.
 */
@Injectable()
export class FakeLlmProvider extends LlmProvider {
  private readonly logger = new Logger(FakeLlmProvider.name);
  private readonly overrides = new Map<string, AiFixture>();
  /** Quantas chamadas cada feature recebeu. Útil para provar cache hit. */
  readonly callCounts = new Map<string, number>();

  constructor(private readonly envService: EnvService) {
    super();
    this.logger.warn(
      'Usando o provider de IA FAKE — nenhuma chamada real à OpenAI será feita',
    );
  }

  resolveModel(tier: LlmTier): string {
    return tier === 'smart'
      ? this.envService.get('AI_MODEL_SMART')
      : this.envService.get('AI_MODEL_FAST');
  }

  /** Troca a resposta de uma feature. Só faz sentido em teste. */
  setFixture(feature: string, fixture: AiFixture): void {
    this.overrides.set(feature, fixture);
  }

  reset(): void {
    this.overrides.clear();
    this.callCounts.clear();
  }

  async generateStructured<TOutput>(
    input: GenerateStructuredInput<TOutput>,
  ): Promise<LlmResult<TOutput>> {
    const startedAt = Date.now();
    this.countCall(input.feature);

    const fixture =
      this.overrides.get(input.feature) ?? AI_FIXTURES[input.feature];

    if (fixture === undefined) {
      throw new AiValidationError(
        input.feature,
        `Nenhuma fixture registrada para a feature "${input.feature}". Adicione em prompts/fixtures.ts.`,
      );
    }

    try {
      const data = input.schema.parse(
        typeof fixture.value === 'function'
          ? fixture.value(input.messages)
          : fixture.value,
      );

      return await Promise.resolve({
        data,
        usage: {
          model: this.resolveModel(input.tier),
          inputTokens: fixture.inputTokens ?? 100,
          outputTokens: fixture.outputTokens ?? 20,
          latencyMs: Date.now() - startedAt,
          repairAttempts: 0,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AiValidationError(input.feature, error.issues);
      }

      throw error;
    }
  }

  async generateText(input: GenerateTextInput): Promise<LlmResult<string>> {
    const startedAt = Date.now();
    this.countCall(input.feature);

    const fixture = this.overrides.get(input.feature);
    const text =
      typeof fixture?.value === 'string' ? fixture.value : 'fake response';

    return await Promise.resolve({
      data: text,
      usage: {
        model: this.resolveModel(input.tier),
        inputTokens: 100,
        outputTokens: 20,
        latencyMs: Date.now() - startedAt,
        repairAttempts: 0,
      },
    });
  }

  private countCall(feature: string): void {
    this.callCounts.set(feature, (this.callCounts.get(feature) ?? 0) + 1);
  }
}
