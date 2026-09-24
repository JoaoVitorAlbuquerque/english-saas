import type { LlmMessage } from '../services/llm.provider';
import {
  draftItemsFixture,
  draftLessonFixture,
  draftRegisterNotesFixture,
  reviewLanguageFixture,
} from './draft-fixtures';

/**
 * Respostas fixas do FakeLlmProvider, uma por feature.
 *
 * Cada prompt novo registra a sua aqui — assim o teste do módulo que usa o
 * prompt roda sem chave da OpenAI e sem gastar token.
 *
 * `value` pode ser uma função das mensagens quando a fixture precisa variar
 * com a entrada (ex.: devolver o nível conforme o tamanho da frase).
 */
export type AiFixture = {
  value: unknown | ((messages: LlmMessage[]) => unknown);
  inputTokens?: number;
  outputTokens?: number;
};

export const AI_FIXTURES: Record<string, AiFixture> = {
  'echo-level': {
    value: {
      level: 'A2',
      confidence: 0.82,
      reason:
        'A frase usa presente simples e vocabulário de rotina, típico de A2.',
      registerNote: {
        written: 'I am going to the park.',
        spoken: "I'm gonna go to the park.",
      },
    },
    inputTokens: 320,
    outputTokens: 64,
  },

  // --- módulo 5: content-studio ---
  //
  // Estas leem a mensagem do turno para devolver conteúdo apontando para os
  // slugs que o teste criou. Ver `draft-fixtures.ts`.
  'draft-lesson': {
    value: draftLessonFixture,
    inputTokens: 2_400,
    outputTokens: 3_100,
  },
  'draft-items': {
    value: draftItemsFixture,
    inputTokens: 900,
    outputTokens: 1_600,
  },
  'draft-register-notes': {
    value: draftRegisterNotesFixture,
    inputTokens: 400,
    outputTokens: 700,
  },
  'review-language': {
    value: reviewLanguageFixture,
    inputTokens: 1_100,
    outputTokens: 120,
  },
};
