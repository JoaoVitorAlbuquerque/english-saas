import {
  creditCostValueSchema,
  creditFeatureSchema,
  cursorPaginationQuerySchema,
  grantBonusSchema,
  updatePlanSchema,
} from '@english-saas/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CreditHistoryQueryDto extends createZodDto(
  cursorPaginationQuerySchema,
) {}

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

export class UpdatePlanDto extends createZodDto(updatePlanSchema) {}

export class GrantBonusDto extends createZodDto(grantBonusSchema) {}

export class CreditCostParamDto extends createZodDto(
  z.object({ feature: creditFeatureSchema }),
) {}

export class UpdateCreditCostDto extends createZodDto(
  z.object({ cost: creditCostValueSchema }),
) {}
