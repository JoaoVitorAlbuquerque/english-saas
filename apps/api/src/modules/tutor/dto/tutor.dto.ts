import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Id gerado pelo cliente para reenviar sem duplicar em rede ruim. */
const clientId = z.string().trim().min(1).max(80);

const lessonStep = {
  lessonId: z.uuid().optional(),
  stepIndex: z.coerce.number().int().min(0).max(50).optional(),
};

function lessonAndStepTogether(
  data: { lessonId?: string | undefined; stepIndex?: number | undefined },
  ctx: z.RefinementCtx,
): void {
  if ((data.lessonId === undefined) !== (data.stepIndex === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['stepIndex'],
      message: 'Informe a lição e a etapa juntas.',
    });
  }
}

export class CreateCorrectionDto extends createZodDto(
  z
    .object({
      ...lessonStep,
      text: z.string().trim().min(1).max(2_000),
      clientRequestId: clientId.optional(),
    })
    .superRefine(lessonAndStepTogether),
) {}

/** Campos do multipart que acompanham o áudio. */
export class CorrectionAudioDto extends createZodDto(
  z
    .object({ ...lessonStep, clientRequestId: clientId.optional() })
    .superRefine(lessonAndStepTogether),
) {}

/**
 * Ou uma etapa de roleplay de uma lição, ou um cenário livre (só Plus).
 * Objeto único com `superRefine`: o `createZodDto` precisa de um objeto,
 * não de uma união.
 */
export class StartRoleplayDto extends createZodDto(
  z
    .object({
      ...lessonStep,
      scenarioFreeText: z.string().trim().min(10).max(600).optional(),
    })
    .superRefine((data, ctx) => {
      const fromLesson =
        data.lessonId !== undefined || data.stepIndex !== undefined;
      const free = data.scenarioFreeText !== undefined;

      if (fromLesson === free) {
        ctx.addIssue({
          code: 'custom',
          path: ['scenarioFreeText'],
          message:
            'Escolha uma etapa de lição ou escreva um cenário — um dos dois.',
        });
        return;
      }

      if (fromLesson) {
        lessonAndStepTogether(data, ctx);
      }
    }),
) {}

export class RoleplayTurnDto extends createZodDto(
  z.object({
    text: z.string().trim().min(1).max(600),
    clientTurnId: clientId.optional(),
  }),
) {}
