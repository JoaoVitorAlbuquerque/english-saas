import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Maior intervalo que o admin pode pedir (ou reprocessar) de uma vez. */
export const MAX_METRICS_DAYS = 180;

const isoDate = z.iso.date();

function spanDays(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

export class ProgressQueryDto extends createZodDto(
  z.object({
    weeks: z.coerce.number().int().min(4).max(26).default(8),
  }),
) {}

/** `from`/`to` opcionais: sem eles, os 30 dias até ontem. */
export class AdminMetricsQueryDto extends createZodDto(
  z
    .object({ from: isoDate.optional(), to: isoDate.optional() })
    .superRefine((range, ctx) => {
      if ((range.from === undefined) !== (range.to === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: ['from'],
          message: 'Informe as duas datas, ou nenhuma.',
        });
        return;
      }

      if (range.from !== undefined && range.to !== undefined) {
        checkRange(range.from, range.to, ctx);
      }
    }),
) {}

export class RebuildMetricsDto extends createZodDto(
  z
    .object({ from: isoDate, to: isoDate })
    .superRefine((range, ctx) => checkRange(range.from, range.to, ctx)),
) {}

function checkRange(from: string, to: string, ctx: z.RefinementCtx): void {
  if (from > to) {
    ctx.addIssue({
      code: 'custom',
      path: ['from'],
      message: 'A data inicial precisa vir antes da final.',
    });
  } else if (spanDays(from, to) >= MAX_METRICS_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: `O intervalo pode ter no máximo ${String(MAX_METRICS_DAYS)} dias.`,
    });
  }
}
