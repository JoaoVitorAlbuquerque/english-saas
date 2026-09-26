import { Injectable } from '@nestjs/common';
import {
  ContentStatus,
  ItemSource,
  type CefrLevel,
  type ItemType,
  type Prisma,
} from '@prisma/client';
import type { Paginated } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  ContentValidationError,
  InvalidTransitionError,
  ItemInUseError,
  ItemIsImmutableError,
  MissingReferencesError,
  SlugInUseError,
} from '../curriculum.errors';
import { resolveDifficulty } from '../domain/difficulty';
import {
  immutableFieldChanges,
  requiresNewItem,
  validateItem,
} from '../domain/item-rules';
import { nextStatus, type ContentAction } from '../domain/versioning';
import { TaxonomyService } from './taxonomy.service';

export type ItemInput = {
  slug?: string | null;
  type: ItemType;
  prompt: string;
  content: unknown;
  acceptedAnswers?: string[];
  explanation: string;
  errorPatternMap?: Record<string, string>;
  cefrLevel: CefrLevel;
  difficulty?: number | null;
  discrimination?: number;
  skillIds: string[];
  source?: ItemSource;
};

/**
 * Exercício de material gerado (13) é do aluno que o recebeu: nunca entra
 * em listagem, prova, revisão, planner, calibração nem lição.
 */
const NOT_GENERATED = {
  source: { not: ItemSource.AI_GENERATED },
} satisfies Prisma.ItemWhereInput;

export type GeneratedItemInput = {
  type: ItemType;
  prompt: string;
  content: unknown;
  acceptedAnswers: string[];
  explanation: string;
  errorPatternMap: Record<string, string>;
  cefrLevel: CefrLevel;
  skillIds: string[];
};

const itemSelect = {
  id: true,
  slug: true,
  type: true,
  prompt: true,
  content: true,
  acceptedAnswers: true,
  explanation: true,
  errorPatternMap: true,
  cefrLevel: true,
  difficulty: true,
  discrimination: true,
  exposureCount: true,
  correctRate: true,
  status: true,
  source: true,
  replacedById: true,
  createdAt: true,
  updatedAt: true,
  skills: { orderBy: { position: 'asc' as const }, select: { skillId: true } },
} satisfies Prisma.ItemSelect;

/**
 * Banco de questões.
 *
 * A regra que molda este serviço: **item publicado é imutável no que define
 * a pergunta**. `exposureCount` e `correctRate` são estatística daquele
 * enunciado — trocar o enunciado e manter o histórico produziria calibração
 * de mentira. Edição em item publicado vira item novo, ligado ao antigo.
 */
@Injectable()
export class ItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  async list(query: {
    cursor?: string | undefined;
    limit: number;
    status?: ContentStatus | undefined;
    level?: CefrLevel | undefined;
    skillId?: string | undefined;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.item.findMany({
      take,
      ...cursorArgs,
      where: {
        ...NOT_GENERATED,
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.level === undefined ? {} : { cefrLevel: query.level }),
        ...(query.skillId === undefined
          ? {}
          : { skills: { some: { skillId: query.skillId } } }),
      },
      orderBy: { id: 'asc' },
      select: itemSelect,
    });

    const page = buildPage(rows, query.limit, (row) => row.id);

    return { ...page, data: page.data.map((row) => this.flatten(row)) };
  }

  async findById(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      select: itemSelect,
    });

    if (item === null) {
      throw new NotFoundError('Não encontramos esta questão.');
    }

    return this.flatten(item);
  }

  async create(input: ItemInput) {
    await this.assertValid(input);

    if (input.slug != null) {
      const existing = await this.prisma.item.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });

      if (existing !== null) {
        throw new SlugInUseError(input.slug);
      }
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: this.toCreateData(input),
        select: { id: true },
      });

      await this.syncSkills(tx, created.id, input.skillIds);

      return created;
    });

    return this.findById(item.id);
  }

  /**
   * Atualiza no lugar. Se o item já foi publicado e a mudança toca o
   * enunciado, recusa e manda criar uma revisão.
   */
  async update(id: string, input: Partial<ItemInput>) {
    const current = await this.findById(id);

    const changes = immutableFieldChanges(
      {
        type: current.type,
        prompt: current.prompt,
        content: current.content,
        acceptedAnswers: current.acceptedAnswers,
      },
      {
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.prompt === undefined ? {} : { prompt: input.prompt }),
        ...(input.content === undefined ? {} : { content: input.content }),
        ...(input.acceptedAnswers === undefined
          ? {}
          : { acceptedAnswers: input.acceptedAnswers }),
      },
    );

    if (requiresNewItem(current.status, changes)) {
      throw new ItemIsImmutableError(changes);
    }

    const merged = {
      type: input.type ?? current.type,
      content: input.content ?? current.content,
      acceptedAnswers: input.acceptedAnswers ?? current.acceptedAnswers,
      errorPatternMap: input.errorPatternMap ?? current.errorPatternMap,
      cefrLevel: input.cefrLevel ?? current.cefrLevel,
      skillIds: input.skillIds ?? current.skillIds,
    };

    await this.assertValid(merged);

    await this.prisma.$transaction(async (tx) => {
      await tx.item.update({
        where: { id },
        data: {
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.prompt === undefined ? {} : { prompt: input.prompt }),
          ...(input.content === undefined
            ? {}
            : { content: input.content as Prisma.InputJsonValue }),
          ...(input.acceptedAnswers === undefined
            ? {}
            : { acceptedAnswers: input.acceptedAnswers }),
          ...(input.explanation === undefined
            ? {}
            : { explanation: input.explanation }),
          ...(input.errorPatternMap === undefined
            ? {}
            : {
                errorPatternMap: input.errorPatternMap as Prisma.InputJsonValue,
              }),
          ...(input.cefrLevel === undefined
            ? {}
            : { cefrLevel: input.cefrLevel }),
          ...(input.difficulty === undefined
            ? {}
            : {
                difficulty: resolveDifficulty(
                  merged.cefrLevel,
                  input.difficulty,
                ),
              }),
          ...(input.discrimination === undefined
            ? {}
            : { discrimination: input.discrimination }),
        },
      });

      if (input.skillIds !== undefined) {
        await tx.itemSkill.deleteMany({ where: { itemId: id } });
        await this.syncSkills(tx, id, input.skillIds);
      }
    });

    return this.findById(id);
  }

  /**
   * Cria a próxima versão de um item publicado.
   *
   * O item novo nasce em DRAFT; o antigo aponta para ele por `replacedById`
   * e só é arquivado quando o novo for publicado — enquanto isso, quem está
   * respondendo a lição no ar continua vendo o antigo.
   */
  async createRevision(id: string, input: Partial<ItemInput>) {
    const current = await this.findById(id);

    if (current.replacedById !== null) {
      throw new InvalidTransitionError(
        'já substituído',
        'criar outra revisão de',
      );
    }

    const next: ItemInput = {
      type: input.type ?? current.type,
      prompt: input.prompt ?? current.prompt,
      content: input.content ?? current.content,
      acceptedAnswers: input.acceptedAnswers ?? current.acceptedAnswers,
      explanation: input.explanation ?? current.explanation,
      errorPatternMap: input.errorPatternMap ?? current.errorPatternMap,
      cefrLevel: input.cefrLevel ?? current.cefrLevel,
      difficulty: input.difficulty ?? current.difficulty,
      discrimination: input.discrimination ?? current.discrimination,
      skillIds: input.skillIds ?? current.skillIds,
      source: input.source ?? current.source,
      slug: null,
    };

    await this.assertValid(next);

    const created = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.item.create({
        data: this.toCreateData(next),
        select: { id: true },
      });

      await this.syncSkills(tx, revision.id, next.skillIds);

      await tx.item.update({
        where: { id },
        data: { replacedById: revision.id },
      });

      return revision;
    });

    return this.findById(created.id);
  }

  /**
   * Exercícios de um material do generator (13): nascem PUBLISHED (o aluno
   * responde na hora, pelo `AnswerService.record`) com `AI_GENERATED`, que
   * os tira de todo o resto. Mesma validação do banco; recebe a transação
   * de quem grava o material, para item e material nascerem juntos.
   */
  async createGeneratedItems(
    items: readonly GeneratedItemInput[],
    tx: Prisma.TransactionClient,
  ): Promise<string[]> {
    for (const item of items) {
      await this.assertValid(item);
    }

    const ids: string[] = [];

    for (const item of items) {
      const created = await tx.item.create({
        data: {
          ...this.toCreateData({ ...item, source: ItemSource.AI_GENERATED }),
          status: ContentStatus.PUBLISHED,
        },
        select: { id: true },
      });

      await this.syncSkills(tx, created.id, item.skillIds);
      ids.push(created.id);
    }

    return ids;
  }

  /** Move o item no fluxo editorial. */
  async transition(id: string, action: ContentAction) {
    const item = await this.findById(id);
    const target = nextStatus(item.status, action);

    if (target === null) {
      throw new InvalidTransitionError(item.status, action);
    }

    if (target === ContentStatus.ARCHIVED) {
      await this.assertNotInUse(id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.item.update({ where: { id }, data: { status: target } });

      // Publicar a revisão aposenta o item que ela substitui.
      if (target === ContentStatus.PUBLISHED) {
        await tx.item.updateMany({
          where: { replacedById: id, status: ContentStatus.PUBLISHED },
          data: { status: ContentStatus.ARCHIVED },
        });
      }
    });

    return this.findById(id);
  }

  /**
   * Quais destes ids existem e estão publicados.
   * O publish da lição usa para recusar prática com item não publicado.
   */
  async publishedItemIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.item.findMany({
      where: {
        id: { in: [...ids] },
        status: ContentStatus.PUBLISHED,
        ...NOT_GENERATED,
      },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  /**
   * Os itens que o modelo do aluno (7) precisa para interpretar respostas:
   * skills **em ordem** (a primeira é a principal), dificuldade, e o que dá
   * para saber dos erros típicos que o item revela. Qualquer status — um
   * item arquivado depois de respondido continua explicando a resposta.
   */
  async findManyForModel(ids: readonly string[]) {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.item.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        type: true,
        prompt: true,
        content: true,
        acceptedAnswers: true,
        errorPatternMap: true,
        cefrLevel: true,
        difficulty: true,
        skills: {
          orderBy: { position: 'asc' },
          select: { skillId: true },
        },
      },
    });

    return rows.map((row) => this.flatten(row));
  }

  /**
   * Questões publicadas que podem entrar numa prova ou lista nivelada (8),
   * com a competência da skill principal — é por ela que o nivelamento
   * alterna. Filtra por skill quando pedido.
   */
  async findCandidates(filter: { skillIds?: readonly string[] } = {}) {
    const rows = await this.prisma.item.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        ...NOT_GENERATED,
        ...(filter.skillIds === undefined
          ? {}
          : { skills: { some: { skillId: { in: [...filter.skillIds] } } } }),
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        type: true,
        difficulty: true,
        exposureCount: true,
        skills: {
          orderBy: { position: 'asc' },
          select: { skillId: true, skill: { select: { competency: true } } },
        },
      },
    });

    return rows.flatMap((row) => {
      const primary = row.skills[0];

      return primary === undefined
        ? []
        : [
            {
              id: row.id,
              type: row.type,
              difficulty: row.difficulty,
              exposureCount: row.exposureCount,
              competency: primary.skill.competency,
              skillIds: row.skills.map((link) => link.skillId),
            },
          ];
    });
  }

  /** Itens com exposição suficiente para calibrar (8), e a skill principal. */
  async findCalibratable(minExposure: number) {
    const rows = await this.prisma.item.findMany({
      where: { exposureCount: { gte: minExposure }, ...NOT_GENERATED },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        difficulty: true,
        skills: {
          orderBy: { position: 'asc' },
          take: 1,
          select: { skillId: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      difficulty: row.difficulty,
      primarySkillId: row.skills[0]?.skillId ?? null,
    }));
  }

  /**
   * Grava a dificuldade recalibrada pelo assessment (8). Como a
   * estatística, não passa pela trava de imutabilidade: a trava protege o
   * enunciado, e a dificuldade é justamente o que se mede dele.
   */
  async applyCalibration(itemId: string, difficulty: number): Promise<void> {
    await this.prisma.item.updateMany({
      where: { id: itemId },
      data: { difficulty },
    });
  }

  /**
   * Grava a estatística de exposição calculada pelo learning (6).
   *
   * Não passa pela trava de imutabilidade: `exposureCount` e `correctRate`
   * são justamente o que muda num item publicado.
   */
  async applyStats(
    itemId: string,
    stats: { exposureCount: number; correctRate: number | null },
  ): Promise<void> {
    // `updateMany`, não `update`: item apagado entre a resposta e o lote não
    // é erro — não há mais o que atualizar, e um job falhando por isso só
    // geraria retentativa inútil.
    await this.prisma.item.updateMany({
      where: { id: itemId },
      data: {
        exposureCount: stats.exposureCount,
        correctRate: stats.correctRate,
      },
    });
  }

  /**
   * Item preso a uma lição publicada não se arquiva: a lição no ar ficaria
   * apontando para uma questão que sumiu.
   */
  private async assertNotInUse(itemId: string): Promise<void> {
    const uses = await this.prisma.lessonVersionItem.findMany({
      where: {
        itemId,
        lessonVersion: { status: ContentStatus.PUBLISHED },
      },
      select: {
        lessonVersion: { select: { lesson: { select: { slug: true } } } },
      },
    });

    if (uses.length > 0) {
      throw new ItemInUseError([
        ...new Set(uses.map((use) => use.lessonVersion.lesson.slug)),
      ]);
    }
  }

  private async assertValid(input: {
    type: ItemType;
    content: unknown;
    acceptedAnswers?: readonly string[] | undefined;
    errorPatternMap?: Record<string, string> | undefined;
    skillIds: string[];
  }): Promise<void> {
    const issues = validateItem({
      type: input.type,
      content: input.content,
      acceptedAnswers: input.acceptedAnswers ?? [],
      ...(input.errorPatternMap === undefined
        ? {}
        : { errorPatternMap: input.errorPatternMap }),
    });

    if (issues.length > 0) {
      throw new ContentValidationError({ issues });
    }

    if (input.skillIds.length === 0) {
      throw new ContentValidationError({
        issues: [
          {
            path: 'skillIds',
            message: 'A questão precisa medir ao menos uma skill.',
          },
        ],
      });
    }

    const foundSkills = new Set(
      await this.taxonomy.existingSkillIds(input.skillIds),
    );
    const missingSkills = input.skillIds.filter((id) => !foundSkills.has(id));

    if (missingSkills.length > 0) {
      throw new MissingReferencesError({ skills: missingSkills });
    }

    const errorPatternIds = [
      ...new Set(Object.values(input.errorPatternMap ?? {})),
    ];
    const foundPatterns = new Set(
      await this.taxonomy.existingErrorPatternIds(errorPatternIds),
    );
    const missingPatterns = errorPatternIds.filter(
      (id) => !foundPatterns.has(id),
    );

    if (missingPatterns.length > 0) {
      throw new MissingReferencesError({ errorPatterns: missingPatterns });
    }
  }

  private toCreateData(input: ItemInput): Prisma.ItemCreateInput {
    return {
      slug: input.slug ?? null,
      type: input.type,
      prompt: input.prompt,
      content: input.content as Prisma.InputJsonValue,
      acceptedAnswers: input.acceptedAnswers ?? [],
      explanation: input.explanation,
      errorPatternMap: (input.errorPatternMap ?? {}) as Prisma.InputJsonValue,
      cefrLevel: input.cefrLevel,
      difficulty: resolveDifficulty(input.cefrLevel, input.difficulty),
      discrimination: input.discrimination ?? 1,
      source: input.source ?? 'HUMAN',
    };
  }

  private async syncSkills(
    tx: Prisma.TransactionClient,
    itemId: string,
    skillIds: readonly string[],
  ): Promise<void> {
    if (skillIds.length === 0) {
      return;
    }

    await tx.itemSkill.createMany({
      data: skillIds.map((skillId, position) => ({
        itemId,
        skillId,
        position,
      })),
      skipDuplicates: true,
    });
  }

  private flatten<
    T extends {
      skills: { skillId: string }[];
      errorPatternMap: Prisma.JsonValue;
    },
  >(item: T) {
    const { skills, errorPatternMap, ...rest } = item;

    return {
      ...rest,
      errorPatternMap: toErrorPatternMap(errorPatternMap),
      skillIds: skills.map((link) => link.skillId),
    };
  }
}

/**
 * O Prisma devolve `Json` como `JsonValue`, que inclui null, número e
 * array. O mapa de erros é sempre `resposta errada → id`, então o que não
 * couber nisso é descartado em vez de contaminar o tipo.
 */
function toErrorPatternMap(value: Prisma.JsonValue): Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}
