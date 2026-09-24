import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ZodError } from 'zod';

import { EnvService } from 'src/common/config/env.service';

import { AiProviderError, AiValidationError } from '../ai.errors';
import {
  MAX_REPAIR_ATTEMPTS,
  buildRepairInstruction,
  extractJson,
} from '../domain/repair';
import { UNTRUSTED_CONTENT_RULE } from '../domain/untrusted';
import {
  LlmProvider,
  type GenerateStructuredInput,
  type GenerateTextInput,
  type LlmMessage,
  type LlmResult,
  type LlmTier,
} from './llm.provider';

type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

/**
 * Provedor OpenAI.
 *
 * Saída estruturada por `response_format: json_schema` em strict mode — o
 * modelo é obrigado a devolver JSON que casa com o schema. Mesmo assim tudo
 * passa pelo zod antes de sair daqui: strict mode não cobre refinements nem
 * regras que só o zod conhece.
 *
 * Timeout e retry para 429/5xx são do próprio SDK, configurados pelo env.
 */
@Injectable()
export class OpenAiProvider extends LlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private cachedClient: OpenAI | undefined;

  constructor(private readonly envService: EnvService) {
    super();
  }

  /**
   * Cliente criado sob demanda.
   *
   * O Nest instancia este provider mesmo quando a factory escolhe o fake, e
   * o SDK recusa `apiKey` vazio já no construtor. Criar aqui deixa a API
   * subir sem chave e só falha quem realmente tentar chamar a OpenAI.
   */
  private get client(): OpenAI {
    if (this.cachedClient !== undefined) {
      return this.cachedClient;
    }

    const apiKey = this.envService.get('OPENAI_API_KEY');

    if (apiKey === undefined) {
      throw new AiProviderError(
        'missing_api_key',
        'OPENAI_API_KEY não está configurada.',
      );
    }

    this.cachedClient = new OpenAI({
      apiKey,
      timeout: this.envService.get('AI_REQUEST_TIMEOUT_MS'),
      // O SDK já faz backoff exponencial em 429, 5xx e erro de conexão.
      maxRetries: this.envService.get('AI_MAX_RETRIES'),
    });

    return this.cachedClient;
  }

  resolveModel(tier: LlmTier): string {
    return tier === 'smart'
      ? this.envService.get('AI_MODEL_SMART')
      : this.envService.get('AI_MODEL_FAST');
  }

  async generateStructured<TOutput>(
    input: GenerateStructuredInput<TOutput>,
  ): Promise<LlmResult<TOutput>> {
    const model = this.resolveModel(input.tier);
    const startedAt = Date.now();

    const messages = this.buildMessages(input.system, input.messages);
    const responseFormat = zodResponseFormat(
      input.schema,
      input.schemaName ?? 'result',
    );

    let inputTokens = 0;
    let outputTokens = 0;
    let lastError: ZodError | undefined;

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
      const completion = await this.complete({
        model,
        messages,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        responseFormat,
        feature: input.feature,
      });

      inputTokens += completion.inputTokens;
      outputTokens += completion.outputTokens;

      try {
        const parsed = input.schema.parse(extractJson(completion.text));

        return {
          data: parsed,
          usage: {
            model,
            inputTokens,
            outputTokens,
            latencyMs: Date.now() - startedAt,
            repairAttempts: attempt,
          },
        };
      } catch (error) {
        if (!(error instanceof ZodError)) {
          // JSON quebrado: trata como falha de schema e tenta o reparo.
          lastError = undefined;
          messages.push(
            { role: 'assistant', content: completion.text },
            {
              role: 'user',
              content:
                'Your previous answer was not valid JSON. Return only a JSON object matching the schema.',
            },
          );
          continue;
        }

        lastError = error;

        if (attempt === MAX_REPAIR_ATTEMPTS) {
          break;
        }

        this.logger.warn(
          { feature: input.feature, model },
          'Saída da IA não passou no zod — pedindo reparo',
        );

        messages.push(
          { role: 'assistant', content: completion.text },
          { role: 'user', content: buildRepairInstruction(error) },
        );
      }
    }

    throw new AiValidationError(
      input.feature,
      lastError === undefined ? undefined : lastError.issues,
    );
  }

  async generateText(input: GenerateTextInput): Promise<LlmResult<string>> {
    const model = this.resolveModel(input.tier);
    const startedAt = Date.now();

    const completion = await this.complete({
      model,
      messages: this.buildMessages(input.system, input.messages),
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      feature: input.feature,
    });

    return {
      data: completion.text,
      usage: {
        model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        latencyMs: Date.now() - startedAt,
        repairAttempts: 0,
      },
    };
  }

  /** O system prompt sempre carrega a regra de conteúdo não confiável. */
  private buildMessages(system: string, messages: LlmMessage[]): ChatMessage[] {
    return [
      { role: 'system', content: `${system}\n\n${UNTRUSTED_CONTENT_RULE}` },
      ...messages.map((message): ChatMessage => ({
        role: message.role,
        content: message.content,
      })),
    ];
  }

  private async complete(params: {
    model: string;
    messages: ChatMessage[];
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    responseFormat?: ReturnType<typeof zodResponseFormat> | undefined;
    feature: string;
  }): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: params.model,
        messages: params.messages,
        ...(params.maxTokens === undefined
          ? {}
          : { max_completion_tokens: params.maxTokens }),
        ...(params.temperature === undefined
          ? {}
          : { temperature: params.temperature }),
        ...(params.responseFormat === undefined
          ? {}
          : { response_format: params.responseFormat }),
      });

      const choice = completion.choices[0];

      if (choice?.message.refusal) {
        throw new AiProviderError('refusal', 'O modelo recusou a solicitação.');
      }

      return {
        text: choice?.message.content ?? '',
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      };
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }

      const reason =
        error instanceof OpenAI.APIError
          ? `${String(error.status)} ${error.name}`
          : 'erro desconhecido';

      // Nunca logamos o conteúdo enviado — só o que identifica a chamada.
      this.logger.error(
        { feature: params.feature, model: params.model, reason },
        'Chamada à OpenAI falhou',
      );

      throw new AiProviderError(reason);
    }
  }
}
