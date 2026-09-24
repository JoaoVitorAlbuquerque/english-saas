import {
  ConsentType,
  InterestSource,
  LearningGoal,
  PreferredStudyTime,
  Role,
  SelfReportedLevel,
  type PrismaClient,
} from '@prisma/client';
import { hash } from 'bcryptjs';

import type { SeedModule } from './seed-module';

/**
 * Contas de desenvolvimento.
 *
 * Senha igual para todas, e só serve em ambiente local — o seed recusa
 * rodar com NODE_ENV=production.
 */
const DEV_PASSWORD = 'english-saas-dev-2026';

type SeedUser = {
  email: string;
  name: string;
  role: Role;
  profile?: {
    goals: LearningGoal[];
    goalNote?: string;
    availabilityMinutes: Record<string, number>;
    preferredStudyTime: PreferredStudyTime;
    selfReportedLevel: SelfReportedLevel;
    targetDate?: Date;
    onboarded: boolean;
  };
  interests?: { topic: string; weight: number }[];
};

const USERS: SeedUser[] = [
  {
    email: 'admin@english-saas.dev',
    name: 'Ana Admin',
    role: Role.ADMIN,
  },
  {
    email: 'editor@english-saas.dev',
    name: 'Edu Editor',
    role: Role.EDITOR,
  },
  {
    // Aluna iniciante, com pouco tempo e prazo apertado.
    email: 'aluno.iniciante@english-saas.dev',
    name: 'Bia Iniciante',
    role: Role.STUDENT,
    profile: {
      goals: [LearningGoal.TRAVEL, LearningGoal.CONVERSATION],
      goalNote: 'Quero conseguir me virar numa viagem em dezembro.',
      availabilityMinutes: {
        mon: 20,
        tue: 20,
        wed: 0,
        thu: 20,
        fri: 0,
        sat: 45,
        sun: 0,
      },
      preferredStudyTime: PreferredStudyTime.NIGHT,
      selfReportedLevel: SelfReportedLevel.BASIC,
      targetDate: new Date('2026-12-15T00:00:00.000Z'),
      onboarded: true,
    },
    interests: [
      { topic: 'travel', weight: 90 },
      { topic: 'cooking', weight: 60 },
      { topic: 'music', weight: 40 },
    ],
  },
  {
    // Aluno intermediário, foco em trabalho, mais tempo disponível.
    email: 'aluno.intermediario@english-saas.dev',
    name: 'Caio Intermediário',
    role: Role.STUDENT,
    profile: {
      goals: [LearningGoal.WORK, LearningGoal.EXAMS],
      availabilityMinutes: {
        mon: 45,
        tue: 45,
        wed: 45,
        thu: 45,
        fri: 30,
        sat: 0,
        sun: 0,
      },
      preferredStudyTime: PreferredStudyTime.MORNING,
      selfReportedLevel: SelfReportedLevel.INTERMEDIATE,
      onboarded: true,
    },
    interests: [
      { topic: 'technology', weight: 95 },
      { topic: 'business', weight: 75 },
      { topic: 'football', weight: 50 },
    ],
  },
];

export const usersSeed: SeedModule = {
  name: '3 auth/users',
  async run(prisma: PrismaClient): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'O seed de usuários cria contas com senha conhecida e não pode rodar em produção.',
      );
    }

    const passwordHash = await hash(DEV_PASSWORD, 12);
    const now = new Date();

    for (const seedUser of USERS) {
      const user = await prisma.user.upsert({
        where: { email: seedUser.email },
        create: {
          email: seedUser.email,
          name: seedUser.name,
          role: seedUser.role,
          passwordHash,
          emailVerifiedAt: now,
          profile: { create: {} },
        },
        update: { name: seedUser.name, role: seedUser.role, passwordHash },
        select: { id: true },
      });

      if (seedUser.profile !== undefined) {
        const profile = seedUser.profile;

        await prisma.studentProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            goals: profile.goals,
            goalNote: profile.goalNote ?? null,
            availabilityMinutes: profile.availabilityMinutes,
            preferredStudyTime: profile.preferredStudyTime,
            selfReportedLevel: profile.selfReportedLevel,
            targetDate: profile.targetDate ?? null,
            onboardingCompletedAt: profile.onboarded ? now : null,
          },
          update: {
            goals: profile.goals,
            goalNote: profile.goalNote ?? null,
            availabilityMinutes: profile.availabilityMinutes,
            preferredStudyTime: profile.preferredStudyTime,
            selfReportedLevel: profile.selfReportedLevel,
            targetDate: profile.targetDate ?? null,
            onboardingCompletedAt: profile.onboarded ? now : null,
          },
        });
      }

      for (const interest of seedUser.interests ?? []) {
        await prisma.studentInterest.upsert({
          where: { userId_topic: { userId: user.id, topic: interest.topic } },
          create: {
            userId: user.id,
            topic: interest.topic,
            weight: interest.weight,
            source: InterestSource.ONBOARDING,
          },
          update: { weight: interest.weight },
        });
      }

      for (const type of [ConsentType.TERMS, ConsentType.PRIVACY_POLICY]) {
        await prisma.consent.upsert({
          where: {
            userId_type_version: {
              userId: user.id,
              type,
              version: process.env['TERMS_VERSION'] ?? '2026-01-01',
            },
          },
          create: {
            userId: user.id,
            type,
            version: process.env['TERMS_VERSION'] ?? '2026-01-01',
            granted: true,
            grantedAt: now,
          },
          update: { granted: true, grantedAt: now },
        });
      }
    }

    console.warn(
      `Seed: ${String(USERS.length)} contas de desenvolvimento (senha: ${DEV_PASSWORD})`,
    );
  },
};
