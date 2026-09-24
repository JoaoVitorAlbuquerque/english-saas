import type { CefrLevel } from '@english-saas/shared';
import { z } from 'zod';

import { draftRegisterNoteSchema } from './draft-shared';
import type { AiPrompt } from './prompt';

/**
 * Rascunho de notas de registro falado.
 *
 * É o coração de um diferencial do produto: mostrar a diferença entre a
 * forma gramatical e o que sai na boca das pessoas (`going to` × `gonna`).
 * O aluno brasileiro entende o livro e não entende a série — é esse buraco.
 */

export const draftRegisterNotesSchema = z.object({
  notes: z.array(draftRegisterNoteSchema).min(1).max(15),
});

export type DraftRegisterNotesOutput = z.infer<typeof draftRegisterNotesSchema>;

export type DraftRegisterNotesContext = {
  level: CefrLevel;
  count: number;
  /** Ids que já existem — para o modelo não repetir o que já temos. */
  existingIds: string[];
};

export const draftRegisterNotesPrompt: AiPrompt<
  DraftRegisterNotesContext,
  DraftRegisterNotesOutput
> = {
  id: 'draft-register-notes',
  version: 1,
  tier: 'smart',
  maxInputChars: 4_000,
  cacheTtlSeconds: 0,
  maxTokens: 4_000,
  temperature: 0.7,

  buildSystem: (context) =>
    [
      'You write "register notes" for Brazilian learners of English: short',
      'entries contrasting the full grammatical form of a phrase with the way',
      'it is actually said in everyday American speech.',
      '',
      `LEVEL: ${context.level} (CEFR).`,
      '- Pick contrasts a learner at this level will actually hear.',
      '- The spoken form must be real, common speech — not slang invented for',
      '  the exercise, not regional curiosities.',
      '',
      'OUTPUT',
      '- "id": a stable slug, lowercase, words joined by hyphens, derived from',
      '  the spoken form ("gonna", "you-coming", "whatcha-doing").',
      '- "spokenForm" and "standardForm": the two versions, in English.',
      '- "explanation": pt-BR. Say what changes and when it is used. Two or',
      '  three sentences, no grammar jargon.',
      '- "whenToAvoid": pt-BR, where the spoken form does not belong',
      '  (formal email, exam writing). null when there is nothing to warn.',
      '',
      'TONE',
      'Write to the student the way a teacher they like would: direct and',
      'friendly, no exclamation marks piled up, no forced slang.',
    ].join('\n'),

  buildUser: (context) => [
    {
      role: 'user',
      content: [
        `Write ${String(context.count)} register notes for level ${context.level}.`,
        '',
        context.existingIds.length === 0
          ? 'Nothing exists yet.'
          : `Do NOT repeat these ids, which already exist: ${context.existingIds.join(', ')}`,
      ].join('\n'),
    },
  ],

  schema: draftRegisterNotesSchema,
};
