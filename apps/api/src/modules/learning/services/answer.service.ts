import { Injectable } from '@nestjs/common';
import {
  ContentStatus,
  ItemSource,
  Prisma,
  type Answer,
  type AnswerContext,
} from '@prisma/client';
import type { AnswerResponse, AnswerVerdict } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CatalogAccessService } from 'src/modules/curriculum/services/catalog-access.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';

import {
  evaluateAnswer,
  responseShapeError,
  type CorrectAnswer,
  type Evaluation,
} from '../domain/evaluate-answer';
import {
  InvalidAnswerResponseError,
  ItemNotInAttemptError,
} from '../learning.errors';
import { AttemptService } from './attempt.service';
import { LearningStatsService } from './learning-stats.service';

export type RecordAnswerInput = {
  userId: string;
  itemId: string;
  context: AnswerContext;
  /** Obrigatório em LESSON, proibido nos outros. */
  attemptId?: string | undefined;
  response: AnswerResponse;
  responseTimeMs: number;
  hintsUsed?: number | undefined;
  clientAnswerId?: string | undefined;
};

export type AnswerResult = {
  answerId: string;
  isCorrect: boolean;
  score: number;
  verdict: AnswerVerdict;
  feedback: string;
  correctAnswer: CorrectAnswer;
  /** pt-BR, a explicação autorada do item. */
  explanation: string;
  errorPatterns: {
    id: string;
    description: string;
    correction: string;
    explanation: string;
  }[];
  isFirstTry: boolean;
};

type LoadedItem = Awaited<ReturnType<ItemService['findById']>>;

/**
 * Resposta a questão objetiva: corrige na hora, grava e avisa.
 *
 * `record` é a porta de entrada de **todos** os contextos. A rota HTTP só
 * deixa o aluno declarar LESSON e REVIEW; nivelamento (8), checkpoint e
 * material gerado (13) chamam este serviço do lado do servidor.
 *
 * A estatística do item **não** é atualizada aqui: o `answer.submitted`
 * enfileira um recálculo em lote (ver `LearningListener`).
 */
@Injectable()
export class AnswerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemService,
    private readonly taxonomy: TaxonomyService,
    private readonly catalog: CatalogService,
    private readonly access: CatalogAccessService,
    private readonly attempts: AttemptService,
    private readonly stats: LearningStatsService,
    private readonly events: EventBusService,
  ) {}

  async record(input: RecordAnswerInput): Promise<AnswerResult> {
    // A rota já confere isso no DTO. Aqui é para quem chama do servidor.
    if ((input.context === 'LESSON') !== (input.attemptId !== undefined)) {
      throw new Error(
        'Resposta LESSON exige attemptId, e só ela pode ter attemptId.',
      );
    }

    if (input.clientAnswerId !== undefined) {
      const previous = await this.prisma.answer.findUnique({
        where: {
          userId_clientAnswerId: {
            userId: input.userId,
            clientAnswerId: input.clientAnswerId,
          },
        },
      });

      if (previous !== null) {
        return this.replay(previous);
      }
    }

    const item = await this.loadPublishedItem(input.itemId);

    // Exercício de material gerado (13) só se responde pelo material dele.
    if (
      item.source === ItemSource.AI_GENERATED &&
      input.context !== 'GENERATED_MATERIAL'
    ) {
      throw new NotFoundError('Esta questão não está disponível.');
    }

    const stepIndex = await this.resolveStep(input);

    const shapeError = responseShapeError(item, input.response);

    if (shapeError !== null) {
      throw new InvalidAnswerResponseError(shapeError);
    }

    const evaluation = evaluateAnswer(item, input.response);
    const isFirstTry = await this.isFirstTry(input);

    let answer: Answer;

    try {
      answer = await this.prisma.answer.create({
        data: {
          userId: input.userId,
          itemId: item.id,
          attemptId: input.attemptId ?? null,
          stepIndex,
          context: input.context,
          response: input.response as Prisma.InputJsonValue,
          isCorrect: evaluation.isCorrect,
          score: evaluation.score,
          responseTimeMs: input.responseTimeMs,
          hintsUsed: input.hintsUsed ?? 0,
          detectedErrorPatterns: evaluation.errorPatterns,
          isFirstTry,
          clientAnswerId: input.clientAnswerId ?? null,
        },
      });
    } catch (error) {
      // O mesmo `clientAnswerId` chegou duas vezes ao mesmo tempo.
      if (
        input.clientAnswerId !== undefined &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.answer.findUniqueOrThrow({
          where: {
            userId_clientAnswerId: {
              userId: input.userId,
              clientAnswerId: input.clientAnswerId,
            },
          },
        });

        return this.replay(winner);
      }

      throw error;
    }

    this.events.emit(
      'answer.submitted',
      {
        answerId: answer.id,
        itemId: item.id,
        attemptId: answer.attemptId,
        context: answer.context,
        skillIds: item.skillIds,
        isCorrect: evaluation.isCorrect,
        score: evaluation.score,
        errorPatterns: evaluation.errorPatterns,
        difficulty: item.difficulty,
        isFirstTry,
        responseTimeMs: input.responseTimeMs,
        hintsUsed: answer.hintsUsed,
      },
      { userId: input.userId },
    );

    await this.stats.recordActivity(input.userId);

    return this.toResult(answer.id, item, evaluation, isFirstTry);
  }

  /**
   * Respostas do aluno depois de um ponto, em ordem de criação.
   *
   * É como o modelo do aluno (7) consome o histórico: ele guarda até onde
   * leu e pede o resto, na ordem em que aconteceu. `id` desempata respostas
   * gravadas no mesmo milissegundo.
   */
  async listSince(
    userId: string,
    after: { at: Date; id: string } | null,
    limit: number,
  ) {
    return this.prisma.answer.findMany({
      where: {
        userId,
        ...(after === null
          ? {}
          : {
              OR: [
                { createdAt: { gt: after.at } },
                { createdAt: after.at, id: { gt: after.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        itemId: true,
        context: true,
        response: true,
        isCorrect: true,
        score: true,
        hintsUsed: true,
        responseTimeMs: true,
        isFirstTry: true,
        detectedErrorPatterns: true,
        createdAt: true,
      },
    });
  }

  /**
   * Questões que o aluno já respondeu, sem repetição — para o assessment
   * (8) não servir de novo. Filtra por janela e por contexto quando pedido.
   */
  async answeredItemIds(
    userId: string,
    filter: { since?: Date; contexts?: readonly AnswerContext[] } = {},
  ): Promise<string[]> {
    const rows = await this.prisma.answer.findMany({
      where: {
        userId,
        ...(filter.since === undefined
          ? {}
          : { createdAt: { gte: filter.since } }),
        ...(filter.contexts === undefined
          ? {}
          : { context: { in: [...filter.contexts] } }),
      },
      distinct: ['itemId'],
      select: { itemId: true },
    });

    return rows.map((row) => row.itemId);
  }

  /**
   * O que o aluno já respondeu destas questões num contexto — o generator
   * (13) mostra o estado de cada exercício do material. A primeira resposta
   * de cada item, que é a que vale.
   */
  async firstAnswersForItems(
    userId: string,
    itemIds: readonly string[],
    context: AnswerContext,
  ) {
    if (itemIds.length === 0) {
      return [];
    }

    return this.prisma.answer.findMany({
      where: { userId, context, itemId: { in: [...itemIds] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      distinct: ['itemId'],
      select: {
        id: true,
        itemId: true,
        isCorrect: true,
        score: true,
        createdAt: true,
      },
    });
  }

  /**
   * Primeiras tentativas por item, com quem respondeu — a matéria-prima da
   * calibração (8).
   */
  async firstTriesForItems(itemIds: readonly string[]) {
    if (itemIds.length === 0) {
      return [];
    }

    return this.prisma.answer.findMany({
      where: { itemId: { in: [...itemIds] }, isFirstTry: true },
      select: { itemId: true, userId: true, isCorrect: true },
    });
  }

  // -------------------------------------------------------------------

  private async loadPublishedItem(itemId: string): Promise<LoadedItem> {
    const item = await this.items.findById(itemId).catch(() => null);

    // Rascunho ou arquivado é o mesmo que não existir, do ponto de vista do
    // aluno — e não confirma que o id existe.
    if (item === null || item.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundError('Esta questão não está disponível.');
    }

    return item;
  }

  /**
   * Em LESSON, a questão precisa estar numa etapa PRACTICE da versão da
   * tentativa. Devolve o índice dessa etapa.
   */
  private async resolveStep(input: RecordAnswerInput): Promise<number | null> {
    if (input.context !== 'LESSON' || input.attemptId === undefined) {
      return null;
    }

    const attempt = await this.attempts.findOpenOwned(
      input.userId,
      input.attemptId,
    );
    // Só LESSON passa por aqui: a revisão (REVIEW) de conteúdo já estudado
    // continua aberta depois de downgrade ou vencimento do plano.
    await this.access.assertLesson(input.userId, attempt.lessonId);
    const outline = await this.catalog.findVersionOutline(
      attempt.lessonVersionId,
    );
    const step = outline.steps.find((candidate) =>
      candidate.itemIds.includes(input.itemId),
    );

    if (step === undefined) {
      throw new ItemNotInAttemptError();
    }

    return step.index;
  }

  /**
   * Primeira resposta a este item nesta tentativa. Fora de lição, cada
   * resposta é uma exposição independente — o SRS (9) mostra o mesmo item
   * de novo dias depois de propósito.
   */
  private async isFirstTry(input: RecordAnswerInput): Promise<boolean> {
    if (input.attemptId === undefined) {
      return true;
    }

    const previous = await this.prisma.answer.count({
      where: { attemptId: input.attemptId, itemId: input.itemId },
    });

    return previous === 0;
  }

  /** Reenvio: devolve o resultado da resposta já gravada. */
  private async replay(answer: Answer): Promise<AnswerResult> {
    const item = await this.items.findById(answer.itemId);
    const evaluation = evaluateAnswer(
      item,
      answer.response as unknown as AnswerResponse,
    );

    return this.toResult(answer.id, item, evaluation, answer.isFirstTry);
  }

  private async toResult(
    answerId: string,
    item: LoadedItem,
    evaluation: Evaluation,
    isFirstTry: boolean,
  ): Promise<AnswerResult> {
    return {
      answerId,
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      verdict: evaluation.verdict,
      feedback: evaluation.feedback,
      correctAnswer: evaluation.correctAnswer,
      explanation: item.explanation,
      errorPatterns: await this.taxonomy.errorPatternSummaries(
        evaluation.errorPatterns,
      ),
      isFirstTry,
    };
  }
}
