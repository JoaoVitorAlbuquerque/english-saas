import { Injectable, Logger } from '@nestjs/common';
import {
  InterestSource,
  type LearningGoal,
  type PreferredStudyTime,
  type Role,
  type SelfReportedLevel,
} from '@prisma/client';
import {
  ANONYMIZATION_GRACE_DAYS,
  type AvailabilityMinutes,
  type Interest,
  type Paginated,
} from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  anonymizationDueAt,
  buildAnonymizedUser,
  daysUntilAnonymization,
  isDueForAnonymization,
} from '../domain/anonymization';
import {
  normalizeAvailability,
  totalWeeklyMinutes,
} from '../domain/availability';
import { normalizeInterests } from '../domain/interests';

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
};

export type ProfileUpdate = {
  goals?: LearningGoal[];
  goalNote?: string | null;
  availabilityMinutes?: Partial<AvailabilityMinutes>;
  preferredStudyTime?: PreferredStudyTime;
  targetDate?: Date | null;
  selfReportedLevel?: SelfReportedLevel;
  timezone?: string;
  nativeLanguage?: string;
};

/**
 * Dados do aluno: conta, perfil e interesses.
 *
 * É o serviço que os outros módulos chamam para ler dados do aluno — ninguém
 * varre as tabelas daqui direto pelo Prisma (ver CLAUDE.md → Convenções).
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    if (user === null) {
      throw new NotFoundError('Não encontramos a sua conta.');
    }

    return user;
  }

  /**
   * Ids das contas ativas, em lotes por cursor (id crescente). Para job que
   * precisa passar por todo mundo — o crédito mensal do billing.
   */
  async listActiveIds(input: {
    afterId?: string | undefined;
    take: number;
  }): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(input.afterId === undefined ? {} : { id: { gt: input.afterId } }),
      },
      orderBy: { id: 'asc' },
      take: input.take,
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  /**
   * Fuso, disponibilidade e data de cadastro de cada conta ativa, em lotes
   * por cursor (id crescente). O progresso (14) agrega a noite inteira por
   * aqui. Sem perfil ainda, o fuso padrão e disponibilidade zero.
   */
  async studyContexts(input: {
    afterId?: string | undefined;
    take: number;
  }): Promise<
    {
      userId: string;
      timezone: string;
      availabilityMinutes: AvailabilityMinutes;
      createdAt: Date;
    }[]
  > {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(input.afterId === undefined ? {} : { id: { gt: input.afterId } }),
      },
      orderBy: { id: 'asc' },
      take: input.take,
      select: {
        id: true,
        createdAt: true,
        profile: { select: { timezone: true, availabilityMinutes: true } },
      },
    });

    return rows.map((row) => ({
      userId: row.id,
      timezone: row.profile?.timezone ?? 'America/Sao_Paulo',
      availabilityMinutes: normalizeAvailability(
        (row.profile?.availabilityMinutes ??
          {}) as Partial<AvailabilityMinutes>,
      ),
      createdAt: row.createdAt,
    }));
  }

  /** O mesmo contexto de `studyContexts`, de um aluno só. */
  async studyContextOf(userId: string): Promise<{
    userId: string;
    timezone: string;
    availabilityMinutes: AvailabilityMinutes;
    createdAt: Date;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        createdAt: true,
        profile: { select: { timezone: true, availabilityMinutes: true } },
      },
    });

    if (user === null) {
      throw new NotFoundError('Não encontramos a sua conta.');
    }

    return {
      userId: user.id,
      timezone: user.profile?.timezone ?? 'America/Sao_Paulo',
      availabilityMinutes: normalizeAvailability(
        (user.profile?.availabilityMinutes ??
          {}) as Partial<AvailabilityMinutes>,
      ),
      createdAt: user.createdAt,
    };
  }

  /** Contas criadas em `[from, to)` — as coortes de retenção. */
  async signupsBetween(
    from: Date,
    to: Date,
  ): Promise<{ userId: string; createdAt: Date }[]> {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lt: to } },
      select: { id: true, createdAt: true },
    });

    return rows.map((row) => ({ userId: row.id, createdAt: row.createdAt }));
  }

  /** E-mail de cada conta pedida (painel interno). Conta apagada fica de fora. */
  async emailsFor(userIds: readonly string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] }, deletedAt: null },
      select: { id: true, email: true },
    });

    return new Map(rows.map((row) => [row.id, row.email]));
  }

  async updateAccount(
    userId: string,
    input: { name?: string },
  ): Promise<{ id: string; name: string }> {
    await this.findById(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
      },
      select: { id: true, name: true },
    });
  }

  // -------------------------------------------------------------------
  // Perfil
  // -------------------------------------------------------------------

  async getProfile(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (profile === null) {
      throw new NotFoundError('Seu perfil de estudo ainda não existe.');
    }

    return {
      ...profile,
      availabilityMinutes: normalizeAvailability(
        profile.availabilityMinutes as Partial<AvailabilityMinutes>,
      ),
    };
  }

  /**
   * Fuso do aluno. Sem perfil (onboarding não feito), o padrão do schema.
   * Sequência de estudo (6) e agenda (10) contam o dia por aqui.
   */
  async timezoneOf(userId: string): Promise<string> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });

    return profile?.timezone ?? 'America/Sao_Paulo';
  }

  async updateProfile(userId: string, input: ProfileUpdate) {
    await this.findById(userId);

    // Só campos escalares: serve tanto para `create` quanto para `update`.
    const data = {
      ...(input.goals === undefined ? {} : { goals: input.goals }),
      ...(input.goalNote === undefined ? {} : { goalNote: input.goalNote }),
      ...(input.preferredStudyTime === undefined
        ? {}
        : { preferredStudyTime: input.preferredStudyTime }),
      ...(input.targetDate === undefined
        ? {}
        : { targetDate: input.targetDate }),
      ...(input.selfReportedLevel === undefined
        ? {}
        : { selfReportedLevel: input.selfReportedLevel }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.nativeLanguage === undefined
        ? {}
        : { nativeLanguage: input.nativeLanguage }),
      ...(input.availabilityMinutes === undefined
        ? {}
        : {
            availabilityMinutes: normalizeAvailability(
              input.availabilityMinutes,
            ),
          }),
    };

    const profile = await this.prisma.studentProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    const availability = normalizeAvailability(
      profile.availabilityMinutes as Partial<AvailabilityMinutes>,
    );

    // Só depois do onboarding: a primeira montagem do plano já sai do
    // `user.onboarded`, que `completeOnboarding` emite chamando este mesmo
    // método por baixo — emitir os dois aqui duplicaria o rebuild inicial.
    const relevantFieldChanged =
      input.availabilityMinutes !== undefined ||
      input.timezone !== undefined ||
      input.targetDate !== undefined ||
      input.goals !== undefined;

    if (relevantFieldChanged && profile.onboardingCompletedAt !== null) {
      this.events.emit(
        'profile.availability_changed',
        {
          userId,
          goals: profile.goals,
          weeklyMinutes: totalWeeklyMinutes(availability),
          timezone: profile.timezone,
          targetDate: profile.targetDate?.toISOString() ?? null,
        },
        { userId },
      );
    }

    return { ...profile, availabilityMinutes: availability };
  }

  // -------------------------------------------------------------------
  // Interesses
  // -------------------------------------------------------------------

  async listInterests(userId: string): Promise<Interest[]> {
    const rows = await this.prisma.studentInterest.findMany({
      where: { userId },
      orderBy: [{ weight: 'desc' }, { topic: 'asc' }],
      select: { topic: true, weight: true },
    });

    return rows;
  }

  /**
   * Substitui a lista escolhida pelo aluno.
   *
   * Só mexe no que veio do onboarding: o que o sistema aprendeu (módulo 7)
   * fica, senão uma edição de perfil apagaria o aprendizado.
   */
  async replaceInterests(
    userId: string,
    interests: Interest[],
  ): Promise<Interest[]> {
    await this.findById(userId);

    const normalized = normalizeInterests(interests);

    await this.prisma.$transaction(async (tx) => {
      await tx.studentInterest.deleteMany({
        where: { userId, source: InterestSource.ONBOARDING },
      });

      if (normalized.length > 0) {
        await tx.studentInterest.createMany({
          data: normalized.map((interest) => ({
            userId,
            topic: interest.topic,
            weight: interest.weight,
            source: InterestSource.ONBOARDING,
          })),
          skipDuplicates: true,
        });
      }
    });

    return this.listInterests(userId);
  }

  /**
   * Grava o peso de um interesse aprendido pelo uso (módulo 7).
   *
   * Tema novo entra como LEARNED; tema que o aluno escolheu continua
   * ONBOARDING, só com o peso ajustado — senão uma edição de perfil
   * apagaria o que ele mesmo escolheu.
   */
  async setInterestWeight(
    userId: string,
    topic: string,
    weight: number,
  ): Promise<void> {
    await this.prisma.studentInterest.upsert({
      where: { userId_topic: { userId, topic } },
      create: { userId, topic, weight, source: InterestSource.LEARNED },
      update: { weight },
    });
  }

  /**
   * O que o modelo do aluno (7) precisa do perfil: objetivos, nível que ele
   * disse ter e interesses. Sem perfil ainda, tudo vazio — o modelo decide
   * o que fazer com a falta de dado.
   */
  async learnerContext(userId: string): Promise<{
    goals: LearningGoal[];
    selfReportedLevel: SelfReportedLevel | null;
    interests: Interest[];
  }> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { goals: true, selfReportedLevel: true },
    });

    return {
      goals: profile?.goals ?? [],
      selfReportedLevel: profile?.selfReportedLevel ?? null,
      interests: await this.listInterests(userId),
    };
  }

  // -------------------------------------------------------------------
  // Painel interno
  // -------------------------------------------------------------------

  /** Listagem paginada por cursor, para o painel de administração. */
  async listForAdmin(query: {
    cursor?: string | undefined;
    limit: number;
  }): Promise<Paginated<AdminUserRow>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.user.findMany({
      take,
      ...cursorArgs,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerifiedAt: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    return buildPage(rows, query.limit, (row) => row.id);
  }

  // -------------------------------------------------------------------
  // Exclusão de conta (LGPD)
  // -------------------------------------------------------------------

  /** Soft delete imediato. A anonimização vem depois da carência. */
  async requestDeletion(userId: string): Promise<{
    deletedAt: Date;
    anonymizeAt: Date;
    daysRemaining: number;
  }> {
    const user = await this.findById(userId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { deletedAt: now },
      });

      // Derruba todas as sessões na hora: o acesso acaba aqui.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    const anonymizeAt = anonymizationDueAt(now);

    this.events.emit(
      'user.deletion_requested',
      {
        userId: user.id,
        deletedAt: now.toISOString(),
        anonymizeAt: anonymizeAt.toISOString(),
      },
      { userId: user.id },
    );

    return {
      deletedAt: now,
      anonymizeAt,
      daysRemaining: ANONYMIZATION_GRACE_DAYS,
    };
  }

  /** Contas cuja carência venceu. Usado pelo job diário. */
  async findDueForAnonymization(now: Date = new Date()): Promise<string[]> {
    const candidates = await this.prisma.user.findMany({
      where: { deletedAt: { not: null }, anonymizedAt: null },
      select: { id: true, deletedAt: true, anonymizedAt: true },
    });

    return candidates
      .filter((user) => isDueForAnonymization(user, now))
      .map((user) => user.id);
  }

  /**
   * Apaga o que identifica a pessoa e mantém a linha.
   *
   * O histórico de uso e de cobrança precisa continuar fechando — o que some
   * é o vínculo com a pessoa real.
   */
  async anonymize(userId: string, now: Date = new Date()): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.studentInterest.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
      await tx.oAuthAccount.deleteMany({ where: { userId } });
      await tx.dataExport.deleteMany({ where: { userId } });

      await tx.studentProfile.updateMany({
        where: { userId },
        data: { goalNote: null, targetDate: null },
      });

      await tx.user.update({
        where: { id: userId },
        data: buildAnonymizedUser(userId, now),
      });
    });

    this.events.emit(
      'user.anonymized',
      { userId, anonymizedAt: now.toISOString() },
      { userId },
    );

    this.logger.log({ userId }, 'Conta anonimizada');
  }

  /** Quantos dias faltam para a anonimização de uma conta já excluída. */
  async deletionStatus(
    userId: string,
  ): Promise<{ deletedAt: Date; daysRemaining: number } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true },
    });

    if (user?.deletedAt == null) {
      return null;
    }

    return {
      deletedAt: user.deletedAt,
      daysRemaining: daysUntilAnonymization(user.deletedAt, new Date()),
    };
  }

  // -------------------------------------------------------------------
  // Onboarding
  // -------------------------------------------------------------------

  async completeOnboarding(
    userId: string,
    input: ProfileUpdate & { interests: Interest[] },
  ) {
    const profile = await this.updateProfile(userId, input);
    const interests = await this.replaceInterests(userId, input.interests);

    const completed = await this.prisma.studentProfile.update({
      where: { userId },
      data: { onboardingCompletedAt: new Date() },
    });

    const availability = normalizeAvailability(
      completed.availabilityMinutes as Partial<AvailabilityMinutes>,
    );

    this.events.emit(
      'user.onboarded',
      {
        userId,
        goals: completed.goals,
        weeklyMinutes: totalWeeklyMinutes(availability),
        selfReportedLevel: completed.selfReportedLevel,
        interests: interests.map((interest) => interest.topic),
        targetDate: completed.targetDate?.toISOString() ?? null,
      },
      { userId },
    );

    return {
      ...profile,
      onboardingCompletedAt: completed.onboardingCompletedAt,
      availabilityMinutes: availability,
      interests,
    };
  }
}
