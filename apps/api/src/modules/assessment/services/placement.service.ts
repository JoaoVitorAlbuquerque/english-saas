import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  AssessmentStatus,
  Prisma,
  WritingStatus,
  type PlacementTest,
} from '@prisma/client';
import {
  CEFR_LEVEL_LABELS,
  COMPETENCY_LABELS,
  type AnswerResponse,
  type Competency,
} from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { AnswerService } from 'src/modules/learning/services/answer.service';
import { UsersService } from 'src/modules/users/services/users.service';

import {
  AssessmentClosedError,
  ItemNotCurrentError,
  NoItemsAvailableError,
  PlacementTooSoonError,
} from '../assessment.errors';
import {
  canRetake,
  currentEstimate,
  nextPlacementItem,
  PLACEMENT_COMPETENCIES,
  PLACEMENT_RULES,
  placementResult,
  retakeAvailableAt,
  startLevelFor,
  stopReason,
  type PlacementCandidate,
  type PlacementResult,
} from '../domain/placement';
import { WritingAssessor } from '../hooks/writing-assessor';
import { AssessmentResponsesService } from './assessment-responses.service';

type Candidate = PlacementCandidate & { skillIds: string[] };

/**
 * Teste de nivelamento adaptativo.
 *
 * Cada resposta roda dentro do request: a correção é do learning e a nova
 * estimativa é um EAP sobre no máximo 30 respostas — bem abaixo de um
 * milissegundo. Não há o que mandar para a fila.
 *
 * **Não há correção item a item.** Mostrar acerto e gabarito no meio
 * ensina e distorce a medida; o desempenho aparece no resultado.
 */
@Injectable()
export class PlacementService {
  private readonly logger = new Logger(PlacementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemService,
    private readonly catalog: CatalogService,
    private readonly taxonomy: TaxonomyService,
    private readonly answers: AnswerService,
    private readonly users: UsersService,
    private readonly responses: AssessmentResponsesService,
    private readonly events: EventBusService,
    @Optional() private readonly writing?: WritingAssessor,
  ) {}

  /** Retoma o teste aberto, ou abre um novo se já passou o prazo. */
  async start(userId: string, random: () => number = Math.random) {
    const open = await this.findOpen(userId);

    if (open !== null) {
      return this.inProgressView(open);
    }

    const lastCompleted = await this.lastCompletedAt(userId);
    const now = new Date();

    if (!canRetake(lastCompleted, now)) {
      throw new PlacementTooSoonError(retakeAvailableAt(lastCompleted) ?? now);
    }

    const { selfReportedLevel } = await this.users.learnerContext(userId);
    const startLevel = startLevelFor(selfReportedLevel);
    const candidates = await this.candidatesFor(userId);
    const first = nextPlacementItem({
      candidates,
      servedItemIds: new Set(),
      theta: currentEstimate([], startLevel).theta,
      answered: 0,
      random,
    });

    if (first === null) {
      throw new NoItemsAvailableError();
    }

    let test: PlacementTest;

    try {
      test = await this.prisma.placementTest.create({
        data: {
          userId,
          startLevel,
          currentItemId: first.id,
          servedItemIds: [first.id],
        },
      });
    } catch (error) {
      // Dois "começar" ao mesmo tempo: o índice parcial deixa um passar.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.findOpen(userId);
        if (winner !== null) return this.inProgressView(winner);
      }

      throw error;
    }

    return this.inProgressView(test);
  }

  async answer(
    userId: string,
    testId: string,
    input: {
      itemId: string;
      response: AnswerResponse;
      responseTimeMs: number;
      clientAnswerId?: string | undefined;
    },
    random: () => number = Math.random,
  ) {
    const test = await this.findOwned(userId, testId);

    // Reenvio da última resposta, que já encerrou o teste: devolve o
    // resultado em vez de um erro.
    if (
      test.status === AssessmentStatus.COMPLETED &&
      test.servedItemIds.includes(input.itemId)
    ) {
      return this.resultView(test);
    }

    if (test.status !== AssessmentStatus.IN_PROGRESS) {
      throw new AssessmentClosedError(test.status);
    }

    if (input.itemId !== test.currentItemId) {
      // Reenvio de uma questão já respondida (a rede caiu depois que o
      // teste avançou): devolve onde o teste está, sem gravar nada.
      if (test.servedItemIds.includes(input.itemId)) {
        return this.inProgressView(test);
      }

      throw new ItemNotCurrentError(test.currentItemId);
    }

    const candidates = await this.candidatesFor(userId);
    const item = candidates.find((candidate) => candidate.id === input.itemId);

    if (item === undefined) {
      // A questão saiu do ar entre servir e responder: segue sem ela.
      throw new NotFoundError('Esta questão não está mais disponível.');
    }

    const recorded = await this.responses.record({
      kind: 'PLACEMENT',
      testId,
      userId,
      item,
      response: input.response,
      responseTimeMs: input.responseTimeMs,
      clientAnswerId: input.clientAnswerId,
    });

    if (!recorded) {
      return this.inProgressView(await this.findOwned(userId, testId));
    }

    const answered = await this.responses.list(testId);
    const estimate = currentEstimate(answered, test.startLevel);
    const served = new Set([...test.servedItemIds]);
    const next = nextPlacementItem({
      candidates,
      servedItemIds: served,
      theta: estimate.theta,
      answered: answered.length,
      random,
    });

    const reason = stopReason({
      answered: answered.length,
      standardError: estimate.standardError,
      hasNextItem: next !== null,
    });

    if (reason !== null || next === null) {
      return this.complete(test, answered, reason === 'BANK_EXHAUSTED');
    }

    const updated = await this.prisma.placementTest.update({
      where: { id: testId },
      data: {
        currentItemId: next.id,
        servedItemIds: { push: next.id },
        theta: estimate.theta,
        standardError: estimate.standardError,
      },
    });

    return this.inProgressView(updated);
  }

  /** O teste mais recente — aberto ou concluído — e quando dá para refazer. */
  async latest(userId: string) {
    const test = await this.prisma.placementTest.findFirst({
      where: { userId, status: { not: AssessmentStatus.ABANDONED } },
      orderBy: { startedAt: 'desc' },
    });

    if (test === null) {
      throw new NotFoundError('Você ainda não fez o teste de nível.');
    }

    return test.status === AssessmentStatus.IN_PROGRESS
      ? this.inProgressView(test)
      : this.resultView(test);
  }

  // -------------------------------------------------------------------

  private async complete(
    test: PlacementTest,
    answered: Awaited<ReturnType<AssessmentResponsesService['list']>>,
    bankExhausted: boolean,
  ) {
    const graph = await this.taxonomy.skillGraph();
    const result: PlacementResult = placementResult({
      responses: answered,
      startLevel: test.startLevel,
      skills: graph,
    });
    const now = new Date();

    const writingPending =
      this.writing === undefined
        ? false
        : await this.writing.requestPlacementWriting({
            userId: test.userId,
            placementId: test.id,
            level: result.overallLevel,
          });

    const completed = await this.prisma.placementTest.update({
      where: { id: test.id },
      data: {
        status: AssessmentStatus.COMPLETED,
        completedAt: now,
        currentItemId: null,
        theta: result.theta,
        standardError: result.standardError,
        overallLevel: result.overallLevel,
        levelsByCompetency:
          result.levelsByCompetency as unknown as Prisma.InputJsonValue,
        masteredSkillIds: result.masteredSkillIds,
        bankExhausted,
        writingStatus: writingPending
          ? WritingStatus.PENDING
          : WritingStatus.NOT_OFFERED,
      },
    });

    this.events.emit(
      'placement.completed',
      {
        placementId: test.id,
        overallLevel: result.overallLevel,
        theta: result.theta,
        standardError: result.standardError,
        levelsByCompetency: result.levelsByCompetency as Record<
          string,
          { theta: number; standardError: number; level: string; items: number }
        >,
        masteredSkillIds: result.masteredSkillIds,
        itemsAnswered: answered.length,
        bankExhausted,
        completedAt: now.toISOString(),
      },
      { userId: test.userId },
    );

    this.logger.log(
      {
        placementId: test.id,
        level: result.overallLevel,
        items: answered.length,
        bankExhausted,
      },
      'Nivelamento concluído',
    );

    return this.resultView(completed);
  }

  /**
   * Questões que podem cair no nivelamento: publicadas, de uma competência
   * que item objetivo mede, e que o aluno não viu em nivelamento anterior —
   * refazer o teste não pode ser decorar o anterior.
   */
  private async candidatesFor(userId: string): Promise<Candidate[]> {
    const [all, seen] = await Promise.all([
      this.items.findCandidates(),
      this.answers.answeredItemIds(userId, { contexts: ['PLACEMENT'] }),
    ]);
    const competencies = new Set<Competency>(PLACEMENT_COMPETENCIES);
    const excluded = new Set(seen);

    return all.filter(
      (item) => competencies.has(item.competency) && !excluded.has(item.id),
    );
  }

  private async findOpen(userId: string) {
    return this.prisma.placementTest.findFirst({
      where: { userId, status: AssessmentStatus.IN_PROGRESS },
    });
  }

  private async findOwned(userId: string, testId: string) {
    const test = await this.prisma.placementTest.findUnique({
      where: { id: testId },
    });

    if (test?.userId !== userId) {
      throw new NotFoundError('Não encontramos este teste.');
    }

    return test;
  }

  private async lastCompletedAt(userId: string): Promise<Date | null> {
    const last = await this.prisma.placementTest.findFirst({
      where: { userId, status: AssessmentStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    return last?.completedAt ?? null;
  }

  private async inProgressView(test: PlacementTest) {
    const [item] =
      test.currentItemId === null
        ? []
        : await this.catalog.studentItems([test.currentItemId]);

    return {
      id: test.id,
      status: test.status,
      answered: Math.max(0, test.servedItemIds.length - 1),
      maxItems: PLACEMENT_RULES.maxItems,
      next: item ?? null,
      result: null,
    };
  }

  private resultView(test: PlacementTest) {
    const levels = (test.levelsByCompetency ?? {}) as Partial<
      Record<
        Competency,
        { level: keyof typeof CEFR_LEVEL_LABELS; items: number }
      >
    >;
    const overall = test.overallLevel;

    return {
      id: test.id,
      status: test.status,
      answered: test.servedItemIds.length,
      maxItems: PLACEMENT_RULES.maxItems,
      next: null,
      result:
        overall === null
          ? null
          : {
              overallLevel: overall,
              label: CEFR_LEVEL_LABELS[overall],
              competencies: (
                Object.entries(levels) as [
                  Competency,
                  { level: keyof typeof CEFR_LEVEL_LABELS; items: number },
                ][]
              ).map(([competency, entry]) => ({
                competency,
                label: COMPETENCY_LABELS[competency],
                level: entry.level,
                items: entry.items,
              })),
              masteredSkillIds: test.masteredSkillIds,
              note: test.bankExhausted
                ? 'Seu nível pode estar acima do que medimos: acabaram as questões disponíveis antes do fim do teste.'
                : null,
              writingStatus: test.writingStatus,
              completedAt: test.completedAt,
              nextAvailableAt: retakeAvailableAt(test.completedAt),
            },
    };
  }
}
