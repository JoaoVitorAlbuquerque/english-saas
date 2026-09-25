import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CheckoutDto extends createZodDto(
  z.object({
    tier: z.enum(['BASE', 'PLUS']),
    billingPeriod: z.enum(['MONTHLY', 'YEARLY']),
    paymentMethod: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']),
    /**
     * CPF (11) ou CNPJ (14), só dígitos. O Asaas pede para emitir cobrança;
     * vai direto para ele e não fica no nosso banco.
     */
    cpfCnpj: z
      .string()
      .regex(/^(\d{11}|\d{14})$/, 'Informe só os números do CPF ou CNPJ.')
      .optional(),
  }),
) {}

export class UpdatePlanDto extends createZodDto(
  z
    .object({
      priceCents: z.number().int().min(0).max(10_000_000).optional(),
      monthlyAiCredits: z.number().int().min(0).max(100_000).optional(),
      active: z.boolean().optional(),
    })
    .refine(
      (data) => Object.values(data).some((value) => value !== undefined),
      {
        message: 'Informe ao menos um campo para alterar.',
      },
    ),
) {}

export class GrantBonusDto extends createZodDto(
  z.object({
    amount: z.number().int().min(1).max(10_000),
    reason: z.string().trim().min(1).max(200),
  }),
) {}
