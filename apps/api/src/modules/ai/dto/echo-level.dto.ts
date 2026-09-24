import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class EchoLevelRequestDto extends createZodDto(
  z.object({
    /** Frase em inglês. Conteúdo do aluno — vai embrulhado como não confiável. */
    sentence: z.string().min(1).max(1_000),
    /** Ignora o cache e força uma geração nova. */
    skipCache: z.boolean().default(false),
  }),
) {}

export class AiUsageQueryDto extends createZodDto(
  z.object({
    userId: z.uuid().optional(),
    feature: z.string().min(1).optional(),
    /** ISO 8601. Sem valor, não filtra por data. */
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  }),
) {}
