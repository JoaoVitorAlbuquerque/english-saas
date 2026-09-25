import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';
import {
  Prisma,
  RoleplayRole,
  RoleplayStatus,
  RoleplayTurnStatus,
  type RoleplaySession,
  type RoleplayTurn,
} from '@prisma/client';
import { Queue } from 'bullmq';

import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import { tutorRoleplayTurnPrompt } from 'src/modules/ai/prompts/tutor-roleplay-turn.prompt';
import { AiService } from 'src/modules/ai/services/ai.service';
import { FeatureNotAvailableError } from 'src/modules/billing/billing.errors';
import {
  canUseFeature,
  ROLEPLAY_TURN_CAP,
} from 'src/modules/billing/domain/entitlements';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';
import { EntitlementsService } from 'src/modules/billing/services/entitlements.service';
import { CatalogAccessService } from 'src/modules/curriculum/services/catalog-access.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';

import {
  applyTurn,
  buildSummary,
  canTakeTurn,
  feedbackFromRoleplay,
  INAPPROPRIATE_REPLY,
  turnLimit,
  type FinishReason,
  type RoleplayGoal,
  type RoleplaySummary,
  type TurnFeedback,
} from '../domain/roleplay';
import {
  ROLEPLAY_TURN_JOB,
  type RoleplayTurnJobData,
} from '../jobs/tutor-jobs';
import {
  RoleplayFinishedError,
  RoleplayTurnInProgressError,
  WrongStepTypeError,
} from '../tutor.errors';

/** Metas do cenário livre: não há etapa por trás, então são as de qualquer conversa. */
const FREE_SCENARIO_GOALS: RoleplayGoal[] = [
  {
    id: 'stay-in-scene',
    description: 'Manter a conversa dentro da situação que você escolheu.',
    skillIds: [],
  },
  {
    id: 'ask-a-question',
    description: 'Fazer pelo menos uma pergunta ao personagem.',
    skillIds: [],
  },
];
const FREE_PERSONA = {
  name: 'Alex',
  bio: 'Pessoa simpática e paciente, que topa qualquer situação que você propuser.',
};
const FREE_OPENING = "Hi there! So, what's going on?";
/** Quantas expressões do catálogo a IA recebe para escolher. */
const EXPRESSION_CATALOG_SIZE = 40;

export type StartRoleplayInput =
  { lessonId: string; stepIndex: number } | { scenarioFreeText: string };

export type TurnView = {
  index: number;
  role: RoleplayRole;
  text: string;
  status: RoleplayTurnStatus;
  feedback: unknown;
};

export type RoleplayView = {
  id: string;
  status: RoleplayStatus;
  freeScenario: boolean;
  scenario: string;
  character: { name: string; bio: string | null };
  goals: { id: string; description: string; met: boolean }[];
  maxTurns: number;
  turnsLeft: number;
  turns: TurnView[];
  summary: unknown;
};

type SessionWithTurns = RoleplaySession & { turns: RoleplayTurn[] };

/**
 * Roleplay com um personagem.
 *
 * A sessão custa 3 créditos, reservados ao começar — conversa não cobra por
 * turno. Os turnos têm teto: o menor entre o da etapa e o do plano. Cada
 * fala do aluno vira um job (tier fast) que escreve a fala do personagem;
 * o cliente acompanha por polling. No fim, um resumo sem nova chamada de IA
 * e um `tutor.feedback` para o learner-model e o SRS.
 */
@Injectable()
export class RoleplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly credits: AiCreditService,
    private readonly entitlements: EntitlementsService,
    private readonly catalog: CatalogService,
    private readonly access: CatalogAccessService,
    private readonly taxonomy: TaxonomyService,
    private readonly profiles: LearnerProfileService,
    private readonly events: EventBusService,
    @InjectQueue(QUEUES.TUTOR) private readonly queue: Queue,
  ) {}

  async start(
    userId: string,
    input: StartRoleplayInput,
  ): Promise<RoleplayView> {
    const { tier } = await this.entitlements.currentPlan(userId);
    const planCap = ROLEPLAY_TURN_CAP[tier];

    let data: Omit<
      Prisma.RoleplaySessionUncheckedCreateInput,
      'userId' | 'creditReservationId'
    >;
    let opening: string | null;

    if ('lessonId' in input) {
      await this.access.assertLesson(userId, input.lessonId);
      const found = await this.catalog.publishedStep(
        input.lessonId,
        input.stepIndex,
      );

      if (found.step.type !== 'ROLEPLAY') {
        throw new WrongStepTypeError('ROLEPLAY');
      }

      const content = found.step.content;
      data = {
        lessonId: input.lessonId,
        lessonVersionId: found.lessonVersionId,
        stepIndex: input.stepIndex,
        characterId: content.characterId,
        scenario: content.scenario,
        goals: content.goals as unknown as Prisma.InputJsonValue,
        goalsMet: [],
        maxTurns: turnLimit(content.maxTurns, planCap),
        vocabularyLevel: content.allowedVocabularyLevel,
      };
      opening = content.openingLine ?? null;
    } else {
      if (!canUseFeature(tier, 'ROLEPLAY_FREE_SCENARIO')) {
        throw new FeatureNotAvailableError('ROLEPLAY_FREE_SCENARIO', tier);
      }

      const snapshot = await this.profiles.getSnapshot(userId);
      data = {
        scenario: input.scenarioFreeText,
        freeScenario: true,
        goals: FREE_SCENARIO_GOALS as unknown as Prisma.InputJsonValue,
        goalsMet: [],
        maxTurns: planCap,
        vocabularyLevel: snapshot.overallLevel.level,
      };
      opening = FREE_OPENING;
    }

    const reservation = await this.credits.reserve(userId, 'TUTOR_ROLEPLAY');
    const session = await this.prisma.roleplaySession.create({
      data: {
        ...data,
        userId,
        creditReservationId: reservation.reservationId,
        ...(opening === null
          ? {}
          : {
              turns: {
                create: {
                  index: 0,
                  role: RoleplayRole.CHARACTER,
                  text: opening,
                },
              },
            }),
      },
      include: { turns: true },
    });

    return this.view(session);
  }

  async get(userId: string, sessionId: string): Promise<RoleplayView> {
    return this.view(await this.owned(userId, sessionId));
  }

  /**
   * Fala do aluno. Grava a fala e a resposta do personagem em PENDING e
   * enfileira; o turno conta na hora, dentro de uma atualização condicional
   * — dois envios simultâneos não passam do teto.
   */
  async submitTurn(
    userId: string,
    sessionId: string,
    input: { text: string; clientTurnId?: string | undefined },
  ): Promise<RoleplayView> {
    const session = await this.owned(userId, sessionId);

    if (
      input.clientTurnId !== undefined &&
      session.turns.some((turn) => turn.clientTurnId === input.clientTurnId)
    ) {
      return this.view(session);
    }

    if (!canTakeTurn(session)) {
      throw new RoleplayFinishedError();
    }

    if (
      session.turns.some((turn) => turn.status === RoleplayTurnStatus.PENDING)
    ) {
      throw new RoleplayTurnInProgressError();
    }

    const next =
      session.turns.reduce((max, turn) => Math.max(max, turn.index), -1) + 1;

    const characterTurn = await this.prisma.$transaction(async (tx) => {
      const counted = await tx.roleplaySession.updateMany({
        where: {
          id: session.id,
          status: RoleplayStatus.ACTIVE,
          studentTurns: { lt: session.maxTurns },
        },
        data: { studentTurns: { increment: 1 } },
      });

      if (counted.count === 0) {
        throw new RoleplayFinishedError();
      }

      await tx.roleplayTurn.create({
        data: {
          sessionId: session.id,
          index: next,
          role: RoleplayRole.STUDENT,
          text: input.text,
          clientTurnId: input.clientTurnId ?? null,
        },
      });

      return tx.roleplayTurn.create({
        data: {
          sessionId: session.id,
          index: next + 1,
          role: RoleplayRole.CHARACTER,
          text: '',
          status: RoleplayTurnStatus.PENDING,
        },
      });
    });

    const job: RoleplayTurnJobData = { turnId: characterTurn.id };
    await this.queue.add(ROLEPLAY_TURN_JOB, job, {
      jobId: `${ROLEPLAY_TURN_JOB}-${characterTurn.id}`,
    });

    return this.get(userId, sessionId);
  }

  /** Encerrar antes: o aluno pede o resumo quando quiser. */
  async finish(userId: string, sessionId: string): Promise<RoleplayView> {
    const session = await this.owned(userId, sessionId);

    if (session.status === RoleplayStatus.ACTIVE) {
      if (
        session.turns.some((turn) => turn.status === RoleplayTurnStatus.PENDING)
      ) {
        throw new RoleplayTurnInProgressError();
      }

      await this.close(session, 'STUDENT', new Date());
    }

    return this.get(userId, sessionId);
  }

  /** Job: a fala do personagem para a última fala do aluno. */
  async processTurn(
    turnId: string,
    now = new Date(),
  ): Promise<{ status: string }> {
    const turn = await this.prisma.roleplayTurn.findUnique({
      where: { id: turnId },
      include: {
        session: { include: { turns: { orderBy: { index: 'asc' } } } },
      },
    });

    if (turn?.status !== RoleplayTurnStatus.PENDING) {
      return { status: 'SKIPPED' };
    }

    const { session } = turn;
    const goals = session.goals as unknown as RoleplayGoal[];
    const [persona, snapshot, errorCatalog, expressionCatalog] =
      await Promise.all([
        session.characterId === null
          ? Promise.resolve(FREE_PERSONA)
          : this.catalog.characterPersona(session.characterId),
        this.profiles.getSnapshot(session.userId),
        this.taxonomy.activeErrorPatterns(),
        this.expressionCatalog(session.vocabularyLevel),
      ]);

    const { data } = await this.ai.run(
      tutorRoleplayTurnPrompt,
      {
        character: persona ?? FREE_PERSONA,
        scenario: session.scenario,
        scenarioIsUntrusted: session.freeScenario,
        goals: goals.map((goal) => ({
          id: goal.id,
          description: goal.description,
        })),
        goalsAlreadyMet: session.goalsMet,
        vocabularyLevel: session.vocabularyLevel,
        learnerLevel: snapshot.overallLevel.level,
        turnsLeft: session.maxTurns - session.studentTurns,
        expressionCatalog,
        errorCatalog,
        // Falas que falharam não entram no histórico — o aluno reenvia.
        history: session.turns
          .filter(
            (t) => t.index < turn.index && t.status === RoleplayTurnStatus.DONE,
          )
          .map((t) => ({ role: t.role, text: t.text })),
      },
      { userId: session.userId },
    );

    const knownErrors = new Set(errorCatalog.map((error) => error.id));
    const knownExpressions = new Set(
      expressionCatalog.map((skill) => skill.id),
    );
    const inline = data.inlineCorrection;
    const feedback = {
      safety: data.safety,
      goalsMet: data.goalsMet,
      inlineCorrection:
        inline === null
          ? null
          : {
              ...inline,
              errorPatternId:
                inline.errorPatternId !== null &&
                knownErrors.has(inline.errorPatternId)
                  ? inline.errorPatternId
                  : null,
            },
      spokenVsStandard: data.spokenVsStandard,
      helpPhrase: data.helpPhrase,
      expressionSkillIds: data.expressionSkillIds.filter((id) =>
        knownExpressions.has(id),
      ),
    };
    const next = applyTurn(
      {
        goals,
        goalsMet: session.goalsMet,
        studentTurns: session.studentTurns,
        maxTurns: session.maxTurns,
        strikes: session.strikes,
      },
      data,
    );

    await this.prisma.$transaction([
      this.prisma.roleplayTurn.update({
        where: { id: turn.id },
        data: {
          status: RoleplayTurnStatus.DONE,
          text:
            data.safety === 'INAPPROPRIATE' ? INAPPROPRIATE_REPLY : data.reply,
          feedback: feedback as unknown as Prisma.InputJsonValue,
        },
      }),
      this.prisma.roleplaySession.update({
        where: { id: session.id },
        data: { goalsMet: next.goalsMet, strikes: next.strikes },
      }),
    ]);

    if (next.finished !== null) {
      await this.close(
        await this.prisma.roleplaySession.findUniqueOrThrow({
          where: { id: session.id },
          include: { turns: true },
        }),
        next.finished,
        now,
      );
    }

    return { status: next.finished === null ? 'REPLIED' : 'FINISHED' };
  }

  /**
   * A última tentativa do job falhou. O turno volta para o aluno reenviar.
   * Se era a primeira fala e o personagem nunca respondeu, a sessão não
   * aconteceu: encerra e devolve o crédito.
   */
  async failTurn(turnId: string): Promise<void> {
    const turn = await this.prisma.roleplayTurn.findUnique({
      where: { id: turnId },
      include: { session: { include: { turns: true } } },
    });

    if (turn?.status !== RoleplayTurnStatus.PENDING) {
      return;
    }

    const { session } = turn;
    const aiReplied = session.turns.some(
      (t) => t.role === RoleplayRole.CHARACTER && t.feedback !== null,
    );

    await this.prisma.$transaction([
      this.prisma.roleplayTurn.update({
        where: { id: turn.id },
        data: { status: RoleplayTurnStatus.FAILED },
      }),
      this.prisma.roleplaySession.update({
        where: { id: session.id },
        data: aiReplied
          ? { studentTurns: { decrement: 1 } }
          : { status: RoleplayStatus.FINISHED, finishedAt: new Date() },
      }),
    ]);

    if (!aiReplied && session.creditReservationId !== null) {
      await this.credits.refund(session.creditReservationId, 'roleplay_failed');
    }
  }

  private async close(
    session: SessionWithTurns,
    finishedBy: FinishReason,
    now: Date,
  ): Promise<void> {
    const goals = session.goals as unknown as RoleplayGoal[];
    const turnFeedback: TurnFeedback[] = session.turns
      .filter((t) => t.role === RoleplayRole.CHARACTER && t.feedback !== null)
      .sort((a, b) => a.index - b.index)
      .map((t) => t.feedback as unknown as TurnFeedback);
    const summary: RoleplaySummary = buildSummary({
      goals,
      goalsMet: session.goalsMet,
      turns: turnFeedback,
      finishedBy,
    });

    const closed = await this.prisma.roleplaySession.updateMany({
      where: { id: session.id, status: RoleplayStatus.ACTIVE },
      data: {
        status: RoleplayStatus.FINISHED,
        summary: summary as unknown as Prisma.InputJsonValue,
        finishedAt: now,
      },
    });

    // Quem fechou primeiro emite; um segundo fechamento não duplica.
    if (closed.count === 0) {
      return;
    }

    this.events.emit(
      'tutor.feedback',
      {
        feedbackId: session.id,
        source: 'ROLEPLAY',
        ...feedbackFromRoleplay({ summary, goals, turns: turnFeedback }),
        at: now.toISOString(),
      },
      { userId: session.userId },
    );
  }

  /** CHUNK e VOCAB_SET até o nível de vocabulário da conversa. */
  private async expressionCatalog(
    level: CefrLevel,
  ): Promise<{ id: string; title: string }[]> {
    const ceiling = CEFR_LEVELS.indexOf(level);
    const graph = await this.taxonomy.skillGraph();

    return graph
      .filter(
        (skill) =>
          (skill.type === 'CHUNK' || skill.type === 'VOCAB_SET') &&
          CEFR_LEVELS.indexOf(skill.cefrLevel) <= ceiling,
      )
      .slice(0, EXPRESSION_CATALOG_SIZE)
      .map((skill) => ({ id: skill.id, title: skill.title }));
  }

  private async owned(
    userId: string,
    sessionId: string,
  ): Promise<SessionWithTurns> {
    const session = await this.prisma.roleplaySession.findFirst({
      where: { id: sessionId, userId },
      include: { turns: { orderBy: { index: 'asc' } } },
    });

    if (session === null) {
      throw new NotFoundError('Não encontramos essa conversa.');
    }

    return session;
  }

  private async view(session: SessionWithTurns): Promise<RoleplayView> {
    const goals = session.goals as unknown as RoleplayGoal[];
    const met = new Set(session.goalsMet);
    const persona =
      session.characterId === null
        ? FREE_PERSONA
        : ((await this.catalog.characterPersona(session.characterId)) ??
          FREE_PERSONA);

    return {
      id: session.id,
      status: session.status,
      freeScenario: session.freeScenario,
      scenario: session.scenario,
      character: persona,
      goals: goals.map((goal) => ({
        id: goal.id,
        description: goal.description,
        met: met.has(goal.id),
      })),
      maxTurns: session.maxTurns,
      turnsLeft:
        session.status === RoleplayStatus.ACTIVE
          ? Math.max(0, session.maxTurns - session.studentTurns)
          : 0,
      turns: [...session.turns]
        .sort((a, b) => a.index - b.index)
        .map((t) => ({
          index: t.index,
          role: t.role,
          text: t.text,
          status: t.status,
          feedback: t.feedback,
        })),
      summary: session.summary,
    };
  }
}
