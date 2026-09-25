import { Injectable } from '@nestjs/common';
import { Prisma, type AssessmentKind, type Competency } from '@prisma/client';
import type { AnswerResponse } from '@english-saas/shared';

import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AnswerService } from 'src/modules/learning/services/answer.service';

export type StoredResponse = {
  itemId: string;
  difficulty: number;
  correct: boolean;
  competency: Competency;
  skillIds: string[];
};

/**
 * Grava a resposta de uma prova.
 *
 * A correção e o registro de verdade são do learning (6), pelo
 * `AnswerService.record` — é o que alimenta a estatística do item e o
 * modelo do aluno. Aqui só se liga a resposta ao teste, com a dificuldade e
 * a competência **congeladas** no momento: a calibração semanal pode mudar
 * a dificuldade do item depois, e a estimativa do teste não pode mudar
 * junto.
 */
@Injectable()
export class AssessmentResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly answers: AnswerService,
  ) {}

  /**
   * Devolve `false` quando a resposta já estava ligada ao teste — reenvio
   * pela rede, ou duas requisições iguais ao mesmo tempo.
   */
  async record(input: {
    kind: AssessmentKind;
    testId: string;
    userId: string;
    item: {
      id: string;
      difficulty: number;
      competency: Competency;
      skillIds: string[];
    };
    response: AnswerResponse;
    responseTimeMs: number;
    clientAnswerId?: string | undefined;
  }): Promise<boolean> {
    const result = await this.answers.record({
      userId: input.userId,
      itemId: input.item.id,
      context: input.kind === 'PLACEMENT' ? 'PLACEMENT' : 'CHECKPOINT',
      response: input.response,
      responseTimeMs: input.responseTimeMs,
      clientAnswerId: input.clientAnswerId,
    });

    const position = await this.prisma.assessmentResponse.count({
      where: { testId: input.testId },
    });

    try {
      await this.prisma.assessmentResponse.create({
        data: {
          kind: input.kind,
          testId: input.testId,
          answerId: result.answerId,
          itemId: input.item.id,
          skillIds: input.item.skillIds,
          competency: input.item.competency,
          difficulty: input.item.difficulty,
          isCorrect: result.isCorrect,
          position,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }

      throw error;
    }

    return true;
  }

  async list(testId: string): Promise<StoredResponse[]> {
    const rows = await this.prisma.assessmentResponse.findMany({
      where: { testId },
      orderBy: { position: 'asc' },
    });

    return rows.map((row) => ({
      itemId: row.itemId,
      difficulty: row.difficulty,
      correct: row.isCorrect,
      competency: row.competency,
      skillIds: row.skillIds,
    }));
  }
}
