import type { ZodType } from 'zod';

export type LlmTier = 'fast' | 'smart';

export type LlmMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type LlmUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** Quantas vezes foi preciso pedir reparo do JSON (0 ou 1). */
  repairAttempts: number;
};

export type GenerateStructuredInput<TOutput> = {
  tier: LlmTier;
  system: string;
  messages: LlmMessage[];
  schema: ZodType<TOutput>;
  /** Nome do schema enviado ao provedor. Só aparece na API, não no resultado. */
  schemaName?: string;
  maxTokens?: number;
  temperature?: number;
  /** Feature que originou a chamada. Vai para o log e para `ai_usages`. */
  feature: string;
  userId?: string;
};

export type GenerateTextInput = {
  tier: LlmTier;
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  feature: string;
  userId?: string;
};

export type LlmResult<TOutput> = {
  data: TOutput;
  usage: LlmUsage;
};

/**
 * Contrato do provedor de LLM.
 *
 * **Nenhum módulo fora do `ai` fala com o SDK da OpenAI.** Todo mundo passa
 * por aqui — é o que mantém validação, retry, custo e cache num lugar só.
 */
export abstract class LlmProvider {
  /**
   * Saída estruturada e validada pelo zod. O caminho normal: quase tudo que
   * pedimos à IA tem forma conhecida.
   */
  abstract generateStructured<TOutput>(
    input: GenerateStructuredInput<TOutput>,
  ): Promise<LlmResult<TOutput>>;

  /** Texto livre. Raro — use só quando não há estrutura a impor. */
  abstract generateText(input: GenerateTextInput): Promise<LlmResult<string>>;

  /** Nome do modelo configurado para o tier. Usado no cache e no log. */
  abstract resolveModel(tier: LlmTier): string;
}
