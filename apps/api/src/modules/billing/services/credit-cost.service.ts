import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  mergeCreditCosts,
  type CreditCosts,
  type CreditFeature,
} from '../domain/credits';

/**
 * Custo em créditos de cada uso de IA. O padrão mora em
 * `DEFAULT_AI_CREDIT_COSTS`; a tabela `ai_credit_costs` guarda só o que o
 * admin mudou. Tabela de quatro linhas: lida a cada reserva, sem cache — um
 * custo novo vale na hora, e o estorno usa o valor do próprio lançamento.
 */
@Injectable()
export class CreditCostService {
  constructor(private readonly prisma: PrismaService) {}

  async all(): Promise<CreditCosts> {
    return mergeCreditCosts(await this.prisma.aiCreditCost.findMany());
  }

  async of(feature: CreditFeature): Promise<number> {
    return (await this.all())[feature];
  }

  /** Devolve o custo de antes e o de agora, para a auditoria. */
  async update(
    feature: CreditFeature,
    cost: number,
    updatedById: string | null,
  ): Promise<{ before: number; after: number }> {
    const before = await this.of(feature);

    await this.prisma.aiCreditCost.upsert({
      where: { feature },
      create: { feature, cost, updatedById },
      update: { cost, updatedById },
    });

    return { before, after: cost };
  }
}
