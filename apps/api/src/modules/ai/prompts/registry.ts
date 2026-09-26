import { draftItemsPrompt } from './draft-items.prompt';
import { draftLessonPrompt } from './draft-lesson.prompt';
import { draftRegisterNotesPrompt } from './draft-register-notes.prompt';
import { echoLevelPrompt } from './echo-level.prompt';
import { generatorExercisesPrompt } from './generator-exercises.prompt';
import { generatorFactCheckPrompt } from './generator-fact-check.prompt';
import { generatorIngestAnalysisPrompt } from './generator-ingest-analysis.prompt';
import { generatorMaterialPrompt } from './generator-material.prompt';
import { generatorRewriteSentencesPrompt } from './generator-rewrite-sentences.prompt';
import { generatorTopicSuggestPrompt } from './generator-topic-suggest.prompt';
import type { AiPrompt } from './prompt';
import { reviewLanguagePrompt } from './review-language.prompt';
import { tutorCorrectionPrompt } from './tutor-correction.prompt';
import { tutorRoleplayTurnPrompt } from './tutor-roleplay-turn.prompt';

/**
 * Todos os prompts do sistema, por id.
 *
 * Registrar aqui é o que permite auditar o catálogo, checar versões e listar
 * o que existe sem caçar string pelo código.
 */
export const AI_PROMPTS = {
  [echoLevelPrompt.id]: echoLevelPrompt,
  [draftLessonPrompt.id]: draftLessonPrompt,
  [draftItemsPrompt.id]: draftItemsPrompt,
  [draftRegisterNotesPrompt.id]: draftRegisterNotesPrompt,
  [reviewLanguagePrompt.id]: reviewLanguagePrompt,
  [tutorCorrectionPrompt.id]: tutorCorrectionPrompt,
  [tutorRoleplayTurnPrompt.id]: tutorRoleplayTurnPrompt,
  [generatorTopicSuggestPrompt.id]: generatorTopicSuggestPrompt,
  [generatorMaterialPrompt.id]: generatorMaterialPrompt,
  [generatorFactCheckPrompt.id]: generatorFactCheckPrompt,
  [generatorRewriteSentencesPrompt.id]: generatorRewriteSentencesPrompt,
  [generatorExercisesPrompt.id]: generatorExercisesPrompt,
  [generatorIngestAnalysisPrompt.id]: generatorIngestAnalysisPrompt,
} as const satisfies Record<string, AiPrompt<never, unknown>>;

export type RegisteredPromptId = keyof typeof AI_PROMPTS;

/** Resumo do catálogo, para o endpoint administrativo. */
export function listPrompts(): {
  id: string;
  version: number;
  tier: string;
  maxInputChars: number;
  cacheTtlSeconds: number;
}[] {
  return Object.values(AI_PROMPTS).map((prompt) => ({
    id: prompt.id,
    version: prompt.version,
    tier: prompt.tier,
    maxInputChars: prompt.maxInputChars,
    cacheTtlSeconds: prompt.cacheTtlSeconds,
  }));
}
