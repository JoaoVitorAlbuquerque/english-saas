import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  localDate,
  registerStudyDay,
  visibleStreak,
  type StreakState,
} from '../domain/streak';

export type LearningStatsView = {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
};

/**
 * XP e sequência do aluno.
 *
 * A regra mora em `domain/streak.ts` e `domain/xp.ts`; aqui só se lê o fuso,
 * se aplica a regra e se grava. A escrita da sequência é um **set**, não um
 * incremento: duas requisições simultâneas no mesmo dia calculam o mesmo
 * valor e gravam o mesmo valor.
 */
@Injectable()
export class LearningStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /** O aluno estudou agora. Atualiza a sequência se o dia é novo. */
  async recordActivity(
    userId: string,
    now: Date = new Date(),
  ): Promise<LearningStatsView> {
    return this.apply(userId, 0, now);
  }

  /** Só leitura: XP e a sequência como o aluno a vê hoje, sem registrar estudo. */
  async get(
    userId: string,
    now: Date = new Date(),
  ): Promise<LearningStatsView> {
    const [row, timezone] = await Promise.all([
      this.prisma.learningStats.findUnique({ where: { userId } }),
      this.users.timezoneOf(userId),
    ]);

    return view(
      row?.totalXp ?? 0,
      {
        currentStreak: row?.currentStreak ?? 0,
        longestStreak: row?.longestStreak ?? 0,
        lastStudyDate: toDateString(row?.lastStudyDate ?? null),
      },
      localDate(now, timezone),
    );
  }

  /** Soma XP e registra o estudo, numa escrita só. */
  async award(
    userId: string,
    xp: number,
    now: Date = new Date(),
  ): Promise<LearningStatsView> {
    return this.apply(userId, xp, now);
  }

  private async apply(
    userId: string,
    xp: number,
    now: Date,
  ): Promise<LearningStatsView> {
    const today = localDate(now, await this.users.timezoneOf(userId));

    try {
      return await this.write(userId, xp, today);
    } catch (error) {
      // Primeira atividade do aluno chegando em duas requisições ao mesmo
      // tempo: as duas tentam criar a linha. A segunda perde e refaz.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.write(userId, xp, today);
      }

      throw error;
    }
  }

  private async write(
    userId: string,
    xp: number,
    today: string,
  ): Promise<LearningStatsView> {
    const row = await this.prisma.learningStats.findUnique({
      where: { userId },
    });

    const current: StreakState = {
      currentStreak: row?.currentStreak ?? 0,
      longestStreak: row?.longestStreak ?? 0,
      lastStudyDate: toDateString(row?.lastStudyDate ?? null),
    };
    const next = registerStudyDay(current, today);

    if (row !== null && next === current && xp === 0) {
      return view(row.totalXp, next, today);
    }

    const streakData = {
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastStudyDate: fromDateString(next.lastStudyDate),
    };

    const saved = await this.prisma.learningStats.upsert({
      where: { userId },
      create: { userId, totalXp: xp, ...streakData },
      update: { totalXp: { increment: xp }, ...streakData },
    });

    return view(saved.totalXp, next, today);
  }
}

function view(
  totalXp: number,
  state: StreakState,
  today: string,
): LearningStatsView {
  return {
    totalXp,
    currentStreak: visibleStreak(state, today),
    longestStreak: state.longestStreak,
    lastStudyDate: state.lastStudyDate,
  };
}

/** `@db.Date` volta como meia-noite UTC. */
function toDateString(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

function fromDateString(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}
