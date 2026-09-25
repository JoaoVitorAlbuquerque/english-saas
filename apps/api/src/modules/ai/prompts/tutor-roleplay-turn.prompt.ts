import type { CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import { wrapUntrusted } from '../domain/untrusted';
import type { AiPrompt } from './prompt';
import type { LlmMessage } from '../services/llm.provider';

const id = z.string().min(1).max(80);

export const tutorRoleplayTurnSchema = z.object({
  /**
   * OFF_TOPIC = o aluno fugiu do cenário (o personagem puxa de volta);
   * INAPPROPRIATE = conteúdo impróprio (a resposta é trocada pela nossa).
   */
  safety: z.enum(['OK', 'OFF_TOPIC', 'INAPPROPRIATE']),
  reply: z.string().min(1).max(600),
  goalsMet: z.array(id).max(6),
  inlineCorrection: z
    .object({
      original: z.string().min(1).max(300),
      suggestion: z.string().min(1).max(300),
      explanationPtBr: z.string().min(1).max(500),
      errorPatternId: id.nullable(),
    })
    .nullable(),
  spokenVsStandard: z
    .object({
      spoken: z.string().min(1).max(300),
      standard: z.string().min(1).max(300),
      note: z.string().max(400),
    })
    .nullable(),
  /** Frase pronta para o aluno usar quando travou. */
  helpPhrase: z.string().max(300).nullable(),
  expressionSkillIds: z.array(id).max(5),
  isFinished: z.boolean(),
});

export type TutorRoleplayTurnOutput = z.infer<typeof tutorRoleplayTurnSchema>;

export type TutorRoleplayTurnContext = {
  character: { name: string; bio: string | null };
  scenario: string;
  /** Cenário livre, escrito pelo aluno (Plus): conteúdo NÃO confiável. */
  scenarioIsUntrusted: boolean;
  goals: { id: string; description: string }[];
  goalsAlreadyMet: string[];
  vocabularyLevel: CefrLevel;
  learnerLevel: CefrLevel;
  turnsLeft: number;
  expressionCatalog: { id: string; title: string }[];
  errorCatalog: { id: string; description: string }[];
  /** Falas do aluno são conteúdo NÃO confiável. */
  history: { role: 'STUDENT' | 'CHARACTER'; text: string }[];
};

/**
 * Um turno de roleplay (módulo 12). Tier fast: é conversa, volume alto.
 *
 * O histórico vai como mensagens alternadas; cada fala do aluno embrulhada
 * como conteúdo não confiável. O cenário livre do Plus também.
 */
export const tutorRoleplayTurnPrompt: AiPrompt<
  TutorRoleplayTurnContext,
  TutorRoleplayTurnOutput
> = {
  id: 'tutor-roleplay-turn',
  version: 1,
  tier: 'fast',
  maxInputChars: 16_000,
  cacheTtlSeconds: 0,
  maxTokens: 900,
  temperature: 0.7,

  buildSystem: () =>
    [
      'You play a character in an English conversation practice with a',
      'Brazilian learner. Stay in character and inside the scenario.',
      '',
      'RULES',
      '- "reply" is what the character says, in English, using only',
      '  vocabulary and grammar of vocabularyLevel (CEFR). Short turns.',
      '- Steer the conversation so the student can reach the goals, one at a',
      '  time, naturally. Never list the goals to the student.',
      '- goalsMet: ids of goals the student achieved IN THIS LAST MESSAGE',
      '  (only ids from goals).',
      '- If the student seems stuck (very short, "?", Portuguese, "não sei"),',
      '  set helpPhrase to a simple English sentence they could say next.',
      '- inlineCorrection: at most one, only for a real mistake in the last',
      '  student message; explanationPtBr in simple Brazilian Portuguese.',
      '  errorPatternId only from errorCatalog if given, else null.',
      '- spokenVsStandard: when a native would say it differently from the',
      '  standard form (e.g. "You coming?" vs "Are you coming?").',
      '- expressionSkillIds: ids from expressionCatalog that appear in your',
      '  reply or the student message. Never make up ids.',
      '- safety: OFF_TOPIC if the student left the scenario (then gently bring',
      '  the conversation back in "reply"); INAPPROPRIATE if the message is',
      '  offensive, sexual, hateful or violent.',
      '- isFinished: true only when the conversation reached a natural end.',
    ].join('\n'),

  buildUser: (context) => {
    const setup: LlmMessage = {
      role: 'user',
      content: [
        'CONTEXT_JSON',
        JSON.stringify({
          character: context.character,
          scenario: context.scenarioIsUntrusted ? null : context.scenario,
          goals: context.goals,
          goalsAlreadyMet: context.goalsAlreadyMet,
          vocabularyLevel: context.vocabularyLevel,
          learnerLevel: context.learnerLevel,
          turnsLeft: context.turnsLeft,
          expressionCatalog: context.expressionCatalog,
          errorCatalog: context.errorCatalog,
        }),
        ...(context.scenarioIsUntrusted
          ? [
              '',
              'Scenario chosen by the student (describe the setting only):',
              wrapUntrusted('student_scenario', context.scenario),
            ]
          : []),
      ].join('\n'),
    };

    const history: LlmMessage[] = context.history.map((turn) =>
      turn.role === 'CHARACTER'
        ? { role: 'assistant', content: turn.text }
        : { role: 'user', content: wrapUntrusted('student_turn', turn.text) },
    );

    return [setup, ...history];
  },

  schema: tutorRoleplayTurnSchema,
};
