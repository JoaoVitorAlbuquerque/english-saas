import {
  cursorPaginationQuerySchema,
  requestItemsDraftSchema,
  requestLessonDraftSchema,
  requestRegisterNotesDraftSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { isAudioKey } from '../domain/tts-plan';

/** Entrada do content-studio. */

export class RequestLessonDraftDto extends createZodDto(
  requestLessonDraftSchema,
) {}

export class RequestItemsDraftDto extends createZodDto(
  requestItemsDraftSchema,
) {}

export class RequestRegisterNotesDraftDto extends createZodDto(
  requestRegisterNotesDraftSchema,
) {}

export class DraftListQueryDto extends createZodDto(
  cursorPaginationQuerySchema.extend({
    status: z
      .enum([
        'QUEUED',
        'GENERATING',
        'QA_RUNNING',
        'READY',
        'FAILED',
        'DISCARDED',
      ])
      .optional(),
    kind: z.enum(['LESSON', 'ITEMS', 'REGISTER_NOTES']).optional(),
  }),
) {}

export const AUDIO_ISSUE_KINDS = [
  'PRONUNCIATION',
  'INTONATION',
  'SPEED',
  'NOISE',
  'OTHER',
] as const;

export class CreateCommentDto extends createZodDto(
  z
    .object({
      target: z.enum(['VERSION', 'STEP', 'ITEM', 'AUDIO']).default('VERSION'),
      /**
       * Ordem da etapa, id da questão ou chave do áudio (`scene:0:2`),
       * conforme o `target`.
       */
      targetRef: z.string().trim().max(120).nullable().optional(),
      /** Só no alvo AUDIO, e obrigatório nele. */
      audioIssue: z.enum(AUDIO_ISSUE_KINDS).optional(),
      /** Nota livre. No alvo AUDIO pode ficar vazia: o tipo já diz o problema. */
      body: z.string().trim().max(2_000),
    })
    .superRefine((value, context) => {
      if (value.target === 'AUDIO') {
        if (value.audioIssue === undefined) {
          context.addIssue({
            code: 'custom',
            path: ['audioIssue'],
            message: 'Diga qual é o problema do áudio.',
          });
        }

        if (value.targetRef === undefined || value.targetRef === null) {
          context.addIssue({
            code: 'custom',
            path: ['targetRef'],
            message: 'Aponte a fala, a questão ou a nota.',
          });
        } else if (!isAudioKey(value.targetRef)) {
          context.addIssue({
            code: 'custom',
            path: ['targetRef'],
            message: 'Esta não é uma chave de áudio válida.',
          });
        }

        return;
      }

      if (value.audioIssue !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['audioIssue'],
          message: 'O tipo de problema só vale para comentário de áudio.',
        });
      }

      if (value.body.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['body'],
          message: 'Escreva o comentário.',
        });
      }
    }),
) {}

export class DraftEstimateQueryDto extends createZodDto(
  z.object({
    kind: z.enum(['LESSON', 'ITEMS', 'REGISTER_NOTES']),
    count: z.coerce.number().int().min(1).max(20).default(1),
  }),
) {}

export class RegenerateAudioDto extends createZodDto(
  z.object({
    keys: z
      .array(
        z.string().refine(isAudioKey, 'Esta não é uma chave de áudio válida.'),
      )
      .min(1)
      .max(60),
    /** Fala mais devagar (ou mais rápido). Sem ele, a velocidade padrão. */
    speakingRate: z.number().min(0.7).max(1.2).optional(),
  }),
) {}

export class CommentListQueryDto extends createZodDto(
  z.object({
    includeResolved: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  }),
) {}
