import { Injectable, Logger } from '@nestjs/common';
import { AiCallStatus, AiTier, Prisma } from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';

import type { LlmTier } from './llm.provider';

export type RecordUsageInput = {
  userId?: string | undefined;
  feature: string;
  promptId: string;
  promptVersion: number;
  model: string;
  tier: LlmTier;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
  latencyMs: number;
  status: AiCallStatus;
  cacheHit?: boolean;
  errorCode?: string | undefined;
  repairAttempts?: number;
};

export type UsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
};

export type UsagePeriod = {
  from?: Date | undefined;
  to?: Date | undefined;
};

/**
 * Registro e totalização do consumo de IA.
 *
 * É a fonte de verdade do custo e a base do débito de `AiCredit` do plano
 * Plus (módulo 11) — por isso registra também as chamadas que falharam: elas
 * custaram tokens do mesmo jeito.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordUsageInput): Promise<void> {
    try {
      await this.prisma.aiUsage.create({
        data: {
          userId: input.userId ?? null,
          feature: input.feature,
          promptId: input.promptId,
          promptVersion: input.promptVersion,
          model: input.model,
          tier: input.tier === 'smart' ? AiTier.SMART : AiTier.FAST,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costUsdMicros: input.costUsdMicros,
          latencyMs: input.latencyMs,
          status: input.status,
          cacheHit: input.cacheHit ?? false,
          errorCode: input.errorCode ?? null,
          repairAttempts: input.repairAttempts ?? 0,
        },
      });
    } catch (error) {
      // Falhar ao registrar uso não pode derrubar a geração que deu certo.
      this.logger.error(
        { err: error, feature: input.feature },
        'Não foi possível registrar o uso de IA',
      );
    }
  }

  async totals(
    filter: { userId?: string; feature?: string } & UsagePeriod = {},
  ): Promise<UsageTotals> {
    const result = await this.prisma.aiUsage.aggregate({
      where: this.buildWhere(filter),
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costUsdMicros: true,
      },
    });

    return {
      calls: result._count._all,
      inputTokens: result._sum.inputTokens ?? 0,
      outputTokens: result._sum.outputTokens ?? 0,
      costUsdMicros: result._sum.costUsdMicros ?? 0,
    };
  }

  async totalsByFeature(
    filter: { userId?: string } & UsagePeriod = {},
  ): Promise<(UsageTotals & { feature: string })[]> {
    const rows = await this.prisma.aiUsage.groupBy({
      by: ['feature'],
      where: this.buildWhere(filter),
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costUsdMicros: true,
      },
    });

    return rows
      .map((row) => ({
        feature: row.feature,
        calls: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        costUsdMicros: row._sum.costUsdMicros ?? 0,
      }))
      .sort((a, b) => b.costUsdMicros - a.costUsdMicros);
  }

  /** Total gasto por um aluno no período. Base do débito de AiCredit. */
  async totalsForUser(
    userId: string,
    period: UsagePeriod = {},
  ): Promise<UsageTotals> {
    return this.totals({ userId, ...period });
  }

  private buildWhere(
    filter: { userId?: string; feature?: string } & UsagePeriod,
  ): Prisma.AiUsageWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};

    if (filter.from !== undefined) {
      createdAt.gte = filter.from;
    }

    if (filter.to !== undefined) {
      createdAt.lte = filter.to;
    }

    return {
      ...(filter.userId === undefined ? {} : { userId: filter.userId }),
      ...(filter.feature === undefined ? {} : { feature: filter.feature }),
      ...(Object.keys(createdAt).length === 0 ? {} : { createdAt }),
    };
  }
}
