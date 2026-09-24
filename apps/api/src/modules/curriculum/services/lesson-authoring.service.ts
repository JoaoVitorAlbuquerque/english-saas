import { Injectable, Logger } from '@nestjs/common';
import {
  ContentStatus,
  type CefrLevel,
  type LessonStepType,
  type Prisma,
} from '@prisma/client';
import type { LessonStepInput } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  ContentValidationError,
  DraftAlreadyOpenError,
  InvalidTransitionError,
  MissingReferencesError,
  SlugInUseError,
} from '../curriculum.errors';
import { collectStepReferences, missingReferences } from '../domain/references';
import { validateSteps, type StepInput } from '../domain/step-content';
import {
  clearsApproval,
  isEditable,
  nextStatus,
  nextVersionNumber,
  statusAfterEdit,
  type ContentAction,
} from '../domain/versioning';
import { CatalogCacheService } from './catalog-cache.service';
import { ItemService } from './item.service';
import { StructureService } from './structure.service';
import { TaxonomyService } from './taxonomy.service';

export type LessonInput = {
  unitId: string;
  slug: string;
  order: number;
  title: string;
  objective: string;
  cefrLevel: CefrLevel;
  estimatedMinutes?: number;
  targetSkillIds?: string[];
};

export type VersionInput = {
  title?: string;
  objective?: string;
  cefrLevel?: CefrLevel;
  estimatedMinutes?: number;
  targetSkillIds?: string[];
};

const versionSelect = {
  id: true,
  version: true,
  status: true,
  title: true,
  objective: true,
  cefrLevel: true,
  estimatedMinutes: true,
  approvedAt: true,
  approvedById: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  lesson: { select: { id: true, slug: true, order: true, unitId: true } },
  steps: {
    orderBy: { order: 'asc' as const },
    select: { id: true, order: true, type: true, content: true },
  },
  targetSkills: {
    orderBy: { position: 'asc' as const },
    select: { skillId: true, position: true },
  },
} satisfies Prisma.LessonVersionSelect;

/**
 * Autoria de lição, com versionamento.
 *
 * Uma `Lesson` é identidade estável; o conteúdo mora em `LessonVersion`.
 * Editar a lição que está no ar não altera o que o aluno vê: abre-se a
 * próxima versão em DRAFT, e o `publishedVersionId` da lição só se move no
 * publish.
 *
 * Só existe **uma versão aberta por vez**. É invariante de serviço, não do
 * banco — duas pessoas editando rascunhos diferentes da mesma lição não
 * teriam como conciliar na hora de publicar.
 */
@Injectable()
export class LessonAuthoringService {
  private readonly logger = new Logger(LessonAuthoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly structure: StructureService,
    private readonly items: ItemService,
    private readonly cache: CatalogCacheService,
    private readonly events: EventBusService,
  ) {}

  // -------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------

  async listLessons(unitId?: string) {
    return this.prisma.lesson.findMany({
      where: unitId === undefined ? {} : { unitId },
      orderBy: [{ unit: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        slug: true,
        order: true,
        unitId: true,
        publishedVersionId: true,
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            status: true,
            title: true,
            publishedAt: true,
          },
        },
      },
    });
  }

  async findLesson(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        order: true,
        unitId: true,
        publishedVersionId: true,
        versions: { orderBy: { version: 'desc' }, select: versionSelect },
      },
    });

    if (lesson === null) {
      throw new NotFoundError('Não encontramos esta lição.');
    }

    return lesson;
  }

  async findVersion(id: string) {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id },
      select: versionSelect,
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    return version;
  }

  // -------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------

  async createLesson(input: LessonInput) {
    await this.structure.findUnit(input.unitId);

    const existing = await this.prisma.lesson.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });

    if (existing !== null) {
      throw new SlugInUseError(input.slug);
    }

    await this.assertSkillsExist(input.targetSkillIds ?? []);

    const lesson = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lesson.create({
        data: { unitId: input.unitId, slug: input.slug, order: input.order },
        select: { id: true },
      });

      const version = await tx.lessonVersion.create({
        data: {
          lessonId: created.id,
          version: 1,
          title: input.title,
          objective: input.objective,
          cefrLevel: input.cefrLevel,
          estimatedMinutes: input.estimatedMinutes ?? 10,
        },
        select: { id: true },
      });

      await this.syncTargetSkills(tx, version.id, input.targetSkillIds ?? []);

      return created;
    });

    return this.findLesson(lesson.id);
  }

  /**
   * Abre a próxima versão, clonando a que está publicada (ou a mais recente,
   * quando a lição nunca publicou).
   */
  async createDraftVersion(lessonId: string) {
    const lesson = await this.findLesson(lessonId);
    const open = lesson.versions.find((version) => isEditable(version.status));

    if (open !== undefined) {
      throw new DraftAlreadyOpenError(open.version);
    }

    const source =
      lesson.versions.find(
        (version) => version.id === lesson.publishedVersionId,
      ) ?? lesson.versions[0];

    if (source === undefined) {
      throw new NotFoundError('Esta lição não tem nenhuma versão para clonar.');
    }

    const version = nextVersionNumber(
      lesson.versions.map((item) => item.version),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.lessonVersion.create({
        data: {
          lessonId,
          version,
          title: source.title,
          objective: source.objective,
          cefrLevel: source.cefrLevel,
          estimatedMinutes: source.estimatedMinutes,
        },
        select: { id: true },
      });

      if (source.steps.length > 0) {
        await tx.lessonStep.createMany({
          data: source.steps.map((step) => ({
            lessonVersionId: draft.id,
            order: step.order,
            type: step.type,
            content: step.content as Prisma.InputJsonValue,
          })),
        });
      }

      await this.syncTargetSkills(
        tx,
        draft.id,
        source.targetSkills.map((target) => target.skillId),
      );

      return draft;
    });

    return this.findVersion(created.id);
  }

  // -------------------------------------------------------------------
  // Edição
  // -------------------------------------------------------------------

  async updateVersion(id: string, input: VersionInput) {
    const version = await this.findVersion(id);

    this.assertEditable(version.status, 'editar');
    await this.assertSkillsExist(input.targetSkillIds ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonVersion.update({
        where: { id },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.objective === undefined
            ? {}
            : { objective: input.objective }),
          ...(input.cefrLevel === undefined
            ? {}
            : { cefrLevel: input.cefrLevel }),
          ...(input.estimatedMinutes === undefined
            ? {}
            : { estimatedMinutes: input.estimatedMinutes }),
          ...this.editSideEffects(version.status),
        },
      });

      if (input.targetSkillIds !== undefined) {
        await tx.lessonTargetSkill.deleteMany({
          where: { lessonVersionId: id },
        });
        await this.syncTargetSkills(tx, id, input.targetSkillIds);
      }
    });

    return this.findVersion(id);
  }

  /** Substitui as etapas inteiras. Validação completa antes de gravar. */
  async replaceSteps(id: string, steps: readonly StepInput[]) {
    const version = await this.findVersion(id);

    this.assertEditable(version.status, 'editar');

    const validation = validateSteps(steps);

    if (!validation.ok) {
      throw new ContentValidationError({ issues: validation.issues });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonStep.deleteMany({ where: { lessonVersionId: id } });

      await tx.lessonStep.createMany({
        data: validation.steps.map((step) => ({
          lessonVersionId: id,
          order: step.order,
          type: step.type as LessonStepType,
          content: step.content as Prisma.InputJsonValue,
        })),
      });

      await tx.lessonVersion.update({
        where: { id },
        data: this.editSideEffects(version.status),
      });
    });

    return this.findVersion(id);
  }

  // -------------------------------------------------------------------
  // Fluxo editorial
  // -------------------------------------------------------------------

  async transition(id: string, action: ContentAction, actorId?: string) {
    const version = await this.findVersion(id);
    const target = nextStatus(version.status, action);

    if (target === null) {
      throw new InvalidTransitionError(version.status, action);
    }

    if (target === ContentStatus.PUBLISHED) {
      return this.publish(id);
    }

    await this.prisma.lessonVersion.update({
      where: { id },
      data: {
        status: target,
        ...(action === 'approve'
          ? { approvedAt: new Date(), approvedById: actorId ?? null }
          : {}),
        ...(action === 'reject'
          ? { approvedAt: null, approvedById: null }
          : {}),
      },
    });

    return this.findVersion(id);
  }

  /**
   * Publica: valida tudo de novo, confere as referências, aposenta a versão
   * anterior e move o ponteiro da lição.
   *
   * A revalidação não é paranoia — o conteúdo foi gravado há dias, e uma
   * skill ou item referenciado pode ter sido arquivado nesse meio-tempo.
   */
  private async publish(id: string) {
    const version = await this.findVersion(id);
    const validation = validateSteps(
      version.steps.map((step) => ({
        order: step.order,
        type: step.type,
        content: step.content,
      })),
    );

    if (!validation.ok) {
      throw new ContentValidationError({ issues: validation.issues });
    }

    const references = collectStepReferences(
      validation.steps as LessonStepInput[],
    );

    const [skills, registerNotes, errorPatterns, characters, assets, items] =
      await Promise.all([
        this.taxonomy.existingSkillIds([
          ...references.skillIds,
          ...version.targetSkills.map((target) => target.skillId),
        ]),
        this.taxonomy.existingRegisterNoteIds(references.registerNoteIds),
        this.taxonomy.existingErrorPatternIds(references.errorPatternIds),
        this.structure.existingCharacterIds(references.characterIds),
        this.structure.existingAssetIds(references.assetIds),
        this.items.publishedItemIds(references.itemIds),
      ]);

    const missing = {
      skills: missingReferences(
        [
          ...new Set([
            ...references.skillIds,
            ...version.targetSkills.map((target) => target.skillId),
          ]),
        ],
        skills,
      ),
      registerNotes: missingReferences(
        references.registerNoteIds,
        registerNotes,
      ),
      errorPatterns: missingReferences(
        references.errorPatternIds,
        errorPatterns,
      ),
      characters: missingReferences(references.characterIds, characters),
      assets: missingReferences(references.assetIds, assets),
      /** Item que não existe **ou** que existe e não está publicado. */
      items: missingReferences(references.itemIds, items),
    };

    if (Object.values(missing).some((list) => list.length > 0)) {
      throw new MissingReferencesError(missing);
    }

    const publishedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      // A versão que estava no ar vira histórico.
      await tx.lessonVersion.updateMany({
        where: {
          lessonId: version.lesson.id,
          status: ContentStatus.PUBLISHED,
          id: { not: id },
        },
        data: { status: ContentStatus.ARCHIVED },
      });

      await tx.lessonVersion.update({
        where: { id },
        data: { status: ContentStatus.PUBLISHED, publishedAt },
      });

      // Índice de uso, reescrito a cada publish: é o que barra arquivar um
      // item que está dentro de uma lição no ar.
      await tx.lessonVersionItem.deleteMany({ where: { lessonVersionId: id } });

      if (references.itemIds.length > 0) {
        await tx.lessonVersionItem.createMany({
          data: references.itemIds.map((itemId) => ({
            lessonVersionId: id,
            itemId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.lesson.update({
        where: { id: version.lesson.id },
        data: { publishedVersionId: id },
      });
    });

    await this.cache.invalidateLists();

    this.events.emit('curriculum.lesson_published', {
      lessonId: version.lesson.id,
      lessonSlug: version.lesson.slug,
      lessonVersionId: id,
      version: version.version,
      cefrLevel: version.cefrLevel,
      targetSkillIds: version.targetSkills.map((target) => target.skillId),
      publishedAt: publishedAt.toISOString(),
    });

    this.logger.log(
      { lessonSlug: version.lesson.slug, version: version.version },
      'Lição publicada',
    );

    return this.findVersion(id);
  }

  // -------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------

  private assertEditable(status: ContentStatus, action: string): void {
    if (!isEditable(status)) {
      throw new InvalidTransitionError(status, action);
    }
  }

  /**
   * Efeito da edição no status: revisão feita sobre conteúdo que mudou não
   * vale mais, então IN_REVIEW e APPROVED voltam para DRAFT e o carimbo de
   * aprovação some junto.
   */
  private editSideEffects(current: ContentStatus) {
    if (!clearsApproval(current)) {
      return {};
    }

    return {
      status: statusAfterEdit(current),
      approvedAt: null,
      approvedById: null,
    };
  }

  private async assertSkillsExist(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const found = new Set(await this.taxonomy.existingSkillIds(ids));
    const missing = ids.filter((id) => !found.has(id));

    if (missing.length > 0) {
      throw new MissingReferencesError({ skills: missing });
    }
  }

  private async syncTargetSkills(
    tx: Prisma.TransactionClient,
    lessonVersionId: string,
    skillIds: readonly string[],
  ): Promise<void> {
    if (skillIds.length === 0) {
      return;
    }

    await tx.lessonTargetSkill.createMany({
      data: skillIds.map((skillId, position) => ({
        lessonVersionId,
        skillId,
        position,
      })),
      skipDuplicates: true,
    });
  }
}
