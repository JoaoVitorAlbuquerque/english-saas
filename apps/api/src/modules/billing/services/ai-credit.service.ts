import { Injectable } from '@nestjs/common';
import { AiCreditEntryKind, Prisma, type PlanTier } from '@prisma/client';
import type { Paginated } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import { InsufficientCreditsError } from '../billing.errors';
import { monthlyTopUp, type CreditFeature } from '../domain/credits';
import { CreditCostService } from './credit-cost.service';

type Tx = Prisma.TransactionClient;

export type CreditReservation = {
  reservationId: string;
  cost: number;
  balanceAfter: number;
};

export type CreditLedgerEntryView = {
  id: string;
  kind: AiCreditEntryKind;
  amount: number;
  feature: string | null;
  reason: string | null;
  cycleKey: string | null;
  createdAt: Date;
};

/**
 * Livro-caixa de créditos de IA. Tudo que mexe no saldo roda numa transação
 * com trava consultiva por aluno no Postgres — duas reservas simultâneas não
 * gastam o mesmo crédito, e o crédito do mês não duplica.
 */
@Injectable()
export class AiCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costs: CreditCostService,
  ) {}

  async balanceFor(userId: string, tx: Tx = this.prisma): Promise<number> {
    const result = await tx.aiCreditLedgerEntry.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    return result._sum.amount ?? 0;
  }

  /** Lançamentos do aluno, mais recente primeiro — o extrato de `GET /me/credits/history`. */
  async history(
    userId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<Paginated<CreditLedgerEntryView>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.aiCreditLedgerEntry.findMany({
      take,
      ...cursorArgs,
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return buildPage(rows, query.limit, (row) => row.id);
  }

  /**
   * Reserva no início do job: debita já (CONSUME). Deu certo, não precisa
   * fazer mais nada — a reserva vira o consumo. Falhou, `refund`.
   */
  async reserve(
    userId: string,
    feature: CreditFeature,
  ): Promise<CreditReservation> {
    const cost = await this.costs.of(feature);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const balance = await this.balanceFor(userId, tx);

      if (balance < cost) {
        throw new InsufficientCreditsError(feature, cost, balance);
      }

      const entry = await tx.aiCreditLedgerEntry.create({
        data: {
          userId,
          kind: AiCreditEntryKind.CONSUME,
          amount: -cost,
          feature,
        },
        select: { id: true },
      });

      return { reservationId: entry.id, cost, balanceAfter: balance - cost };
    });
  }

  /**
   * Devolve uma reserva. Idempotente: estornar de novo o mesmo consumo não
   * faz nada (`reversalOfId` é único). Devolve se estornou agora.
   */
  async refund(reservationId: string, reason?: string): Promise<boolean> {
    const consume = await this.prisma.aiCreditLedgerEntry.findUnique({
      where: { id: reservationId },
    });

    if (consume === null || consume.kind !== AiCreditEntryKind.CONSUME) {
      return false;
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, consume.userId);

      const existing = await tx.aiCreditLedgerEntry.findUnique({
        where: { reversalOfId: reservationId },
        select: { id: true },
      });

      if (existing !== null) {
        return false;
      }

      await tx.aiCreditLedgerEntry.create({
        data: {
          userId: consume.userId,
          kind: AiCreditEntryKind.REFUND,
          amount: -consume.amount,
          feature: consume.feature,
          reason: reason ?? null,
          reversalOfId: reservationId,
        },
      });

      return true;
    });
  }

  /**
   * Reserva, roda o trabalho e estorna se ele lançar. É o caminho que o
   * tutor e o generator usam em volta do `AiService.run`.
   */
  async spend<T>(
    userId: string,
    feature: CreditFeature,
    work: (reservation: CreditReservation) => Promise<T>,
  ): Promise<T> {
    const reservation = await this.reserve(userId, feature);

    try {
      return await work(reservation);
    } catch (error) {
      await this.refund(reservation.reservationId, 'job_failed');
      throw error;
    }
  }

  /**
   * Crédito do ciclo: repõe até a cota. Uma vez por `cycleKey` — reentregar
   * o webhook ou reprocessar o cron não credita de novo. `null` = já tinha.
   */
  async grantCycle(
    input: {
      userId: string;
      tier: PlanTier;
      monthlyCredits: number;
      cycleKey: string;
    },
    tx?: Tx,
  ): Promise<{ amount: number } | null> {
    const run = async (client: Tx) => {
      await this.lockUser(client, input.userId);

      const existing = await client.aiCreditLedgerEntry.findUnique({
        where: {
          userId_kind_cycleKey: {
            userId: input.userId,
            kind: AiCreditEntryKind.GRANT,
            cycleKey: input.cycleKey,
          },
        },
        select: { id: true },
      });

      if (existing !== null) {
        return null;
      }

      const balance = await this.balanceFor(input.userId, client);
      const amount = monthlyTopUp(balance, input.monthlyCredits);

      // Grava mesmo com 0: é o que marca o ciclo como já creditado.
      await client.aiCreditLedgerEntry.create({
        data: {
          userId: input.userId,
          kind: AiCreditEntryKind.GRANT,
          amount,
          reason: `monthly_${input.tier.toLowerCase()}`,
          cycleKey: input.cycleKey,
        },
      });

      return { amount };
    };

    return tx === undefined ? this.prisma.$transaction(run) : run(tx);
  }

  async grantBonus(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<number> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockUser(tx, userId);
        await tx.aiCreditLedgerEntry.create({
          data: { userId, kind: AiCreditEntryKind.BONUS, amount, reason },
        });

        return this.balanceFor(userId, tx);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundError('Aluno não encontrado.');
      }

      throw error;
    }
  }

  /** Trava consultiva do Postgres, solta sozinha no fim da transação. */
  private async lockUser(tx: Tx, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`;
  }
}
