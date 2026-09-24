import type { ZodType } from 'zod';

import type { LlmMessage, LlmTier } from '../services/llm.provider';

/**
 * Um prompt versionado.
 *
 * Toda chamada de IA passa por um destes — nada de string solta espalhada
 * pelos módulos. O `id` e a `version` viajam até a tabela `ai_usages`, então
 * dá para saber depois exatamente qual prompt produziu qual resultado.
 *
 * Mudou o texto de um jeito que altera a saída? **Suba a `version`.** É o que
 * invalida o cache e o que separa as métricas de antes e depois.
 */
export type AiPrompt<TContext, TOutput> = {
  /** Estável para sempre, em kebab-case: 'echo-level', 'grade-writing'. */
  id: string;
  version: number;
  /** 'fast' para volume e tarefa simples; 'smart' para o que é caro e sensível. */
  tier: LlmTier;
  /** Teto de caracteres do conteúdo não confiável desta feature. */
  maxInputChars: number;
  /** Por quanto tempo vale o resultado no cache. 0 desliga o cache. */
  cacheTtlSeconds: number;
  maxTokens: number;
  temperature: number;

  /** Instrução nossa. A regra de untrusted_content é anexada automaticamente. */
  buildSystem: (context: TContext) => string;
  /** Mensagens do turno. Conteúdo do aluno vai embrulhado em wrapUntrusted. */
  buildUser: (context: TContext) => LlmMessage[];
  /**
   * O que entra na chave de cache. Por padrão é o contexto inteiro; defina
   * quando parte do contexto não deve influenciar o resultado.
   */
  cacheInput?: (context: TContext) => unknown;

  schema: ZodType<TOutput>;
};

/** Identidade de um prompt, do jeito que é registrada em `ai_usages`. */
export type PromptIdentity = {
  promptId: string;
  promptVersion: number;
};

export function promptIdentity<TContext, TOutput>(
  prompt: AiPrompt<TContext, TOutput>,
): PromptIdentity {
  return { promptId: prompt.id, promptVersion: prompt.version };
}
