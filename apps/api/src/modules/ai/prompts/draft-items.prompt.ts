import type { CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import {
  DRAFTABLE_ITEM_TYPES,
  draftItemSchema,
  ITEM_RULES,
  levelRules,
} from './draft-shared';
import type { AiPrompt } from './prompt';

/**
 * Rascunho de questões avulsas para uma skill.
 *
 * É o que enche o banco para o nivelamento adaptativo (módulo 8) ter de onde
 * sortear. Sai em DRAFT com `source = AI_DRAFT`.
 */

export const draftItemsSchema = z.object({
  items: z.array(draftItemSchema).min(1).max(20),
});

export type DraftItemsOutput = z.infer<typeof draftItemsSchema>;

export type DraftItemsContext = {
  level: CefrLevel;
  skill: {
    id: string;
    title: string;
    type: string;
    description: string | null;
  };
  count: number;
  types: (typeof DRAFTABLE_ITEM_TYPES)[number][];
  errorPatterns: { id: string; example: string; correction: string }[];
  registerNotes: { id: string; spokenForm: string; standardForm: string }[];
  maxOutOfLevelPct: number;
};

export const draftItemsPrompt: AiPrompt<DraftItemsContext, DraftItemsOutput> = {
  id: 'draft-items',
  version: 1,
  tier: 'smart',
  maxInputChars: 6_000,
  cacheTtlSeconds: 0,
  maxTokens: 6_000,
  temperature: 0.8,

  buildSystem: (context) =>
    [
      'You are a senior ELT assessment writer producing practice items for a',
      'Brazilian adult learner of English. A human editor reviews every item',
      'before it reaches a student.',
      '',
      levelRules(context.level, context.maxOutOfLevelPct),
      '',
      ITEM_RULES,
      '',
      'VARIETY',
      '- Items must differ from each other: different sentences, different',
      '  vocabulary, different distractors. Do not restate one item.',
      '- Distractors must be plausible mistakes a Brazilian would make, not',
      '  obvious nonsense.',
      '- Vary the difficulty inside the level: some items easy, some hard.',
      '',
      'HARD CONSTRAINTS',
      '- Every item measures the given skill; put its id first in "skillIds".',
      '- Do not invent error pattern ids or register note ids.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        `Write ${String(context.count)} ${context.level} items.`,
        '',
        `SKILL: ${context.skill.id} [${context.skill.type}] ${context.skill.title}`,
        context.skill.description === null
          ? ''
          : `Description: ${context.skill.description}`,
        '',
        `ALLOWED ITEM TYPES: ${context.types.join(', ')}`,
        '',
        'AVAILABLE ERROR PATTERNS (for "errorPatterns"):',
        ...context.errorPatterns.map(
          (pattern) =>
            `- ${pattern.id}: "${pattern.example}" → "${pattern.correction}"`,
        ),
        '',
        'AVAILABLE REGISTER NOTES (for REGISTER_SWAP items):',
        ...context.registerNotes.map(
          (note) =>
            `- ${note.id}: "${note.spokenForm}" = "${note.standardForm}"`,
        ),
      ]
        .filter((line) => line !== '')
        .join('\n'),
    },
  ],

  schema: draftItemsSchema,
};
