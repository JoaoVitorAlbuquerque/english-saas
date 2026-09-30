import { Injectable, Logger } from '@nestjs/common';
import {
  MaterialDifficultyFeedback,
  type GeneratedMaterial,
} from '@prisma/client';
import type { AnswerResponse, Paginated } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CatalogService } from 'src/modules/curriculum/services/catalog.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import {
  AnswerService,
  type AnswerResult,
} from 'src/modules/learning/services/answer.service';
import { LearnerInterestService } from 'src/modules/learner-model/services/learner-interest.service';
import { normalizeTerm } from 'src/modules/srs/domain/card-creation';
import { TermReviewService } from 'src/modules/srs/services/term-review.service';

import { ratingSignal } from '../domain/calibration';
import type { MaterialContent } from '../domain/material';

export type MaterialSummary = {
  id: string;
  kind: GeneratedMaterial['kind'];
  title: string;
  level: GeneratedMaterial['level'];
  topic: string;
  targetSkills: { id: string; title: string }[];
  exerciseCount: number;
  rating: number | null;
  difficulty: MaterialDifficultyFeedback | null;
  createdAt: Date;
};

/**
 * Os materiais do aluno ("Seus materiais"). Privados: toda leitura filtra
 * pelo dono.
 *
 * Nada aqui trava por plano: material gerado continua do aluno depois de
 * um downgrade, como a revisão do que ele já estudou.
 */
@Injectable()
export class MaterialService {
  private readonly logger = new Logger(MaterialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly taxonomy: TaxonomyService,
    private readonly answers: AnswerService,
    private readonly interests: LearnerInterestService,
    private readonly termReview: TermReviewService,
  ) {}

  /** Do mais novo para o mais antigo: nível e alvos mostram a evolução. */
  async list(
    userId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<Paginated<MaterialSummary>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);
    const rows = await this.prisma.generatedMaterial.findMany({
      take,
      ...cursorArgs,
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const page = buildPage(rows, query.limit, (row) => row.id);
    const titles = await this.skillTitles(
      page.data.flatMap((row) => row.targetSkillIds),
    );

    return {
      ...page,
      data: page.data.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        level: row.level,
        topic: row.topic,
        targetSkills: row.targetSkillIds.map((id) => ({
          id,
          title: titles.get(id) ?? id,
        })),
        exerciseCount: row.itemIds.length,
        rating: row.rating,
        difficulty: row.difficulty,
        createdAt: row.createdAt,
      })),
    };
  }

  async get(userId: string, materialId: string) {
    const material = await this.findOwned(userId, materialId);
    const content = await this.contentOf(material);

    const termKeys = content.vocabulary.map((entry) =>
      normalizeTerm(entry.term),
    );

    const [items, answered, titles, inReview] = await Promise.all([
      this.catalog.studentItems(material.itemIds),
      this.answers.firstAnswersForItems(
        userId,
        material.itemIds,
        'GENERATED_MATERIAL',
      ),
      this.skillTitles(material.targetSkillIds),
      this.termReview.activeKeys(userId, termKeys),
    ]);
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const answerByItem = new Map(answered.map((row) => [row.itemId, row]));

    return {
      id: material.id,
      kind: material.kind,
      title: material.title,
      level: material.level,
      topic: material.topic,
      targetSkills: material.targetSkillIds.map((id) => ({
        id,
        title: titles.get(id) ?? id,
      })),
      content: {
        ...content,
        // `termKey` é o termo normalizado — o que as rotas de revisão do
        // vocabulário recebem; `inReview`, se o card TERM está ativo.
        vocabulary: content.vocabulary.map((entry, index) => {
          const termKey = termKeys[index] ?? '';
          return { ...entry, termKey, inReview: inReview.has(termKey) };
        }),
      },
      attribution: material.attribution,
      referenceUrl: material.referenceUrl,
      // Sem gabarito: o `studentItems` do catálogo já tira a resposta.
      exercises: material.itemIds.flatMap((itemId) => {
        const item = itemsById.get(itemId);
        const answer = answerByItem.get(itemId);
        return item === undefined
          ? []
          : [
              {
                ...item,
                answer:
                  answer === undefined
                    ? null
                    : { isCorrect: answer.isCorrect, score: answer.score },
              },
            ];
      }),
      snapshotUsed: material.snapshotUsed,
      feedback: {
        rating: material.rating,
        difficulty: material.difficulty,
      },
      createdAt: material.createdAt,
    };
  }

  /**
   * Resposta a um exercício do material. Vai pelo `AnswerService.record`
   * do learning (contexto GENERATED_MATERIAL): o `answer.submitted` leva ao
   * modelo do aluno e ao SRS como qualquer resposta.
   *
   * Uma resposta por exercício: o `clientAnswerId` é derivado do material e
   * do item, então responder de novo devolve a primeira — o material não
   * vira máquina de "primeira tentativa" para inflar o modelo.
   */
  async answer(
    userId: string,
    materialId: string,
    input: {
      itemId: string;
      response: AnswerResponse;
      responseTimeMs: number;
      hintsUsed?: number | undefined;
    },
  ): Promise<AnswerResult> {
    const material = await this.findOwned(userId, materialId);

    if (!material.itemIds.includes(input.itemId)) {
      throw new NotFoundError('Esse exercício não é deste material.');
    }

    return this.answers.record({
      userId,
      itemId: input.itemId,
      context: 'GENERATED_MATERIAL',
      response: input.response,
      responseTimeMs: input.responseTimeMs,
      hintsUsed: input.hintsUsed,
      clientAnswerId: `material:${material.id}:${input.itemId}`,
    });
  }

  /**
   * Avaliação do aluno. A nota vira sinal de interesse no modelo (só na
   * primeira avaliação — reavaliar não soma de novo); a dificuldade entra
   * na calibração do nível dos próximos materiais.
   */
  async feedback(
    userId: string,
    materialId: string,
    input: {
      rating: number;
      difficulty?: MaterialDifficultyFeedback | undefined;
    },
  ) {
    const material = await this.findOwned(userId, materialId);
    const firstTime = material.feedbackAt === null;

    const updated = await this.prisma.generatedMaterial.update({
      where: { id: material.id },
      data: {
        rating: input.rating,
        difficulty: input.difficulty ?? MaterialDifficultyFeedback.OK,
        feedbackAt: new Date(),
      },
    });

    const signal = ratingSignal(input.rating);

    if (firstTime && signal !== null) {
      try {
        await this.interests.applySignal(userId, material.topic, signal);
      } catch (error) {
        this.logger.warn({ err: error }, 'Sinal de interesse falhou');
      }
    }

    return {
      id: updated.id,
      rating: updated.rating,
      difficulty: updated.difficulty,
    };
  }

  /**
   * "Adicionar à revisão" de um termo do vocabulário. Idempotente: o termo
   * que já tem card ativo continua como está; o suspenso volta de onde
   * parou.
   */
  async addTermToReview(
    userId: string,
    materialId: string,
    termKey: string,
  ): Promise<{ termKey: string; inReview: boolean }> {
    const { key, entry } = await this.vocabularyEntry(
      userId,
      materialId,
      termKey,
    );

    await this.termReview.add(userId, 'GENERATED_MATERIAL', {
      term: entry.term,
      meaning: entry.meaningPtBr,
      example: entry.example,
      cefrLevel: entry.cefr,
    });

    return { termKey: key, inReview: true };
  }

  /** "Remover" da revisão: suspende o card, sem apagar o histórico. */
  async removeTermFromReview(
    userId: string,
    materialId: string,
    termKey: string,
  ): Promise<{ termKey: string; inReview: boolean }> {
    const { key } = await this.vocabularyEntry(userId, materialId, termKey);

    await this.termReview.remove(userId, key);

    return { termKey: key, inReview: false };
  }

  /** O termo precisa estar no vocabulário deste material, do aluno. */
  private async vocabularyEntry(
    userId: string,
    materialId: string,
    termKey: string,
  ): Promise<{ key: string; entry: MaterialContent['vocabulary'][number] }> {
    const material = await this.findOwned(userId, materialId);
    const content = await this.contentOf(material);
    const key = normalizeTerm(termKey);
    const entry = content.vocabulary.find(
      (candidate) => normalizeTerm(candidate.term) === key,
    );

    if (key.length === 0 || entry === undefined) {
      throw new NotFoundError('Esse termo não é deste material.');
    }

    return { key, entry };
  }

  private async findOwned(
    userId: string,
    materialId: string,
  ): Promise<GeneratedMaterial> {
    const material = await this.prisma.generatedMaterial.findFirst({
      where: { id: materialId, userId },
    });

    if (material === null) {
      throw new NotFoundError('Não encontramos esse material.');
    }

    return material;
  }

  private async contentOf(
    material: GeneratedMaterial,
  ): Promise<MaterialContent> {
    if (material.baseId === null) {
      return material.content as unknown as MaterialContent;
    }

    const base = await this.prisma.materialBase.findUniqueOrThrow({
      where: { id: material.baseId },
      select: { content: true },
    });
    return base.content as unknown as MaterialContent;
  }

  private async skillTitles(
    ids: readonly string[],
  ): Promise<Map<string, string>> {
    const skills = await this.taxonomy.skillsByIds([...new Set(ids)]);
    return new Map(skills.map((skill) => [skill.id, skill.title]));
  }
}
