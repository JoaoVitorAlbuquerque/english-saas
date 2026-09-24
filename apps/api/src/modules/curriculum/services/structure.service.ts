import { Injectable } from '@nestjs/common';
import type {
  CefrLevel,
  ContentStatus,
  MediaKind,
  Prisma,
} from '@prisma/client';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { STORAGE_PREFIXES } from 'src/infra/storage/storage-keys';

import {
  InvalidTransitionError,
  MissingReferencesError,
  SlugInUseError,
} from '../curriculum.errors';
import {
  isEditable,
  nextStatus,
  type ContentAction,
} from '../domain/versioning';
import { CatalogCacheService } from './catalog-cache.service';

/**
 * Autoria da estrutura: curso, nível, unidade, personagem, mídia e apostila.
 *
 * Estrutura é esqueleto — quem carrega conteúdo é a lição (ver
 * `LessonAuthoringService`).
 */

export type CourseInput = {
  slug: string;
  title: string;
  language?: string;
  description?: string | null;
};

export type LevelInput = {
  courseId: string;
  cefrLevel: CefrLevel;
  title: string;
  description?: string | null;
  objectives?: string[];
  order: number;
};

export type UnitInput = {
  levelId: string;
  slug: string;
  order: number;
  title: string;
  synopsis?: string | null;
  coverAssetId?: string | null;
  characterIds?: string[];
};

export type CharacterInput = {
  slug: string;
  name: string;
  bio?: string | null;
  voiceId?: string | null;
  avatarAssetId?: string | null;
};

export type MediaAssetInput = {
  kind: MediaKind;
  storageKey: string;
  mimeType: string;
  sizeBytes?: number | null;
  durationMs?: number | null;
  meta?: Record<string, unknown>;
};

export type WorkbookInput = {
  unitId: string;
  slug: string;
  title: string;
  description?: string | null;
  order: number;
  assetId: string;
};

@Injectable()
export class StructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCacheService,
  ) {}

  // -------------------------------------------------------------------
  // Curso e nível
  // -------------------------------------------------------------------

  async listCourses() {
    return this.prisma.course.findMany({
      orderBy: { slug: 'asc' },
      include: { levels: { orderBy: { order: 'asc' } } },
    });
  }

  async createCourse(input: CourseInput) {
    await this.assertSlugFree('course', input.slug);

    return this.prisma.course.create({
      data: {
        slug: input.slug,
        title: input.title,
        language: input.language ?? 'en',
        description: input.description ?? null,
      },
    });
  }

  async createLevel(input: LevelInput) {
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true },
    });

    if (course === null) {
      throw new MissingReferencesError({ courses: [input.courseId] });
    }

    const level = await this.prisma.level.create({
      data: {
        courseId: input.courseId,
        cefrLevel: input.cefrLevel,
        title: input.title,
        description: input.description ?? null,
        objectives: input.objectives ?? [],
        order: input.order,
      },
    });

    await this.cache.invalidateLists();

    return level;
  }

  async updateLevel(id: string, input: Partial<LevelInput>) {
    await this.findLevel(id);

    const level = await this.prisma.level.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        ...(input.objectives === undefined
          ? {}
          : { objectives: input.objectives }),
        ...(input.order === undefined ? {} : { order: input.order }),
      },
    });

    await this.cache.invalidateLists();

    return level;
  }

  async findLevel(id: string) {
    const level = await this.prisma.level.findUnique({ where: { id } });

    if (level === null) {
      throw new NotFoundError('Não encontramos este nível.');
    }

    return level;
  }

  // -------------------------------------------------------------------
  // Unidade
  // -------------------------------------------------------------------

  async listUnits(levelId?: string) {
    return this.prisma.unit.findMany({
      where: levelId === undefined ? {} : { levelId },
      orderBy: [{ level: { order: 'asc' } }, { order: 'asc' }],
      include: {
        cast: { include: { character: true } },
        lessons: { orderBy: { order: 'asc' } },
      },
    });
  }

  async findUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        cast: { include: { character: true } },
        lessons: {
          orderBy: { order: 'asc' },
          include: { versions: { orderBy: { version: 'desc' } } },
        },
        workbooks: true,
      },
    });

    if (unit === null) {
      throw new NotFoundError('Não encontramos esta unidade.');
    }

    return unit;
  }

  async createUnit(input: UnitInput) {
    await this.findLevel(input.levelId);
    await this.assertSlugFree('unit', input.slug);
    await this.assertCharactersExist(input.characterIds ?? []);

    const unit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.unit.create({
        data: {
          levelId: input.levelId,
          slug: input.slug,
          order: input.order,
          title: input.title,
          synopsis: input.synopsis ?? null,
          coverAssetId: input.coverAssetId ?? null,
        },
      });

      await this.syncCast(tx, created.id, input.characterIds ?? []);

      return created;
    });

    await this.cache.invalidateLists();

    return this.findUnit(unit.id);
  }

  async updateUnit(id: string, input: Partial<UnitInput>) {
    await this.findUnit(id);
    await this.assertCharactersExist(input.characterIds ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.unit.update({
        where: { id },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.order === undefined ? {} : { order: input.order }),
          ...(input.synopsis === undefined ? {} : { synopsis: input.synopsis }),
          ...(input.coverAssetId === undefined
            ? {}
            : { coverAssetId: input.coverAssetId }),
        },
      });

      if (input.characterIds !== undefined) {
        await tx.unitCharacter.deleteMany({ where: { unitId: id } });
        await this.syncCast(tx, id, input.characterIds);
      }
    });

    await this.cache.invalidateLists();

    return this.findUnit(id);
  }

  /** Move a unidade no fluxo editorial. Publicar libera ela no catálogo. */
  async transitionUnit(id: string, action: ContentAction) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: { status: true },
    });

    if (unit === null) {
      throw new NotFoundError('Não encontramos esta unidade.');
    }

    const target = nextStatus(unit.status, action);

    if (target === null) {
      throw new InvalidTransitionError(unit.status, action);
    }

    await this.prisma.unit.update({ where: { id }, data: { status: target } });
    await this.cache.invalidateLists();

    return this.findUnit(id);
  }

  // -------------------------------------------------------------------
  // Personagem
  // -------------------------------------------------------------------

  async listCharacters() {
    return this.prisma.character.findMany({ orderBy: { slug: 'asc' } });
  }

  async createCharacter(input: CharacterInput) {
    await this.assertSlugFree('character', input.slug);

    return this.prisma.character.create({
      data: {
        slug: input.slug,
        name: input.name,
        bio: input.bio ?? null,
        voiceId: input.voiceId ?? null,
        avatarAssetId: input.avatarAssetId ?? null,
      },
    });
  }

  async updateCharacter(id: string, input: Partial<CharacterInput>) {
    const character = await this.prisma.character.findUnique({ where: { id } });

    if (character === null) {
      throw new NotFoundError('Não encontramos este personagem.');
    }

    const updated = await this.prisma.character.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.bio === undefined ? {} : { bio: input.bio }),
        ...(input.voiceId === undefined ? {} : { voiceId: input.voiceId }),
        ...(input.avatarAssetId === undefined
          ? {}
          : { avatarAssetId: input.avatarAssetId }),
      },
    });

    await this.cache.invalidateLists();

    return updated;
  }

  // -------------------------------------------------------------------
  // Mídia
  // -------------------------------------------------------------------

  /**
   * Registra um objeto que já está no bucket.
   *
   * A chave precisa estar sob `content/`: conteúdo base não se mistura com
   * `uploads/` (dado do aluno) nem com `generated/` (saída de IA).
   */
  async registerMediaAsset(input: MediaAssetInput) {
    if (!input.storageKey.startsWith(`${STORAGE_PREFIXES.CONTENT}/`)) {
      throw new MissingReferencesError({
        storageKey: input.storageKey,
        reason: `A chave precisa começar com "${STORAGE_PREFIXES.CONTENT}/".`,
      });
    }

    const existing = await this.prisma.mediaAsset.findUnique({
      where: { storageKey: input.storageKey },
    });

    if (existing !== null) {
      return existing;
    }

    return this.prisma.mediaAsset.create({
      data: {
        kind: input.kind,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes ?? null,
        durationMs: input.durationMs ?? null,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async listMediaAssets(kind?: MediaKind) {
    return this.prisma.mediaAsset.findMany({
      where: kind === undefined ? {} : { kind },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Quais desses ids de asset existem. Usado pelo publish da lição. */
  async existingAssetIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async existingCharacterIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.character.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  // -------------------------------------------------------------------
  // Apostila
  // -------------------------------------------------------------------

  async createWorkbook(input: WorkbookInput) {
    await this.findUnit(input.unitId);
    await this.assertSlugFree('workbook', input.slug);

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: input.assetId },
      select: { kind: true },
    });

    if (asset === null) {
      throw new MissingReferencesError({ assets: [input.assetId] });
    }

    if (asset.kind !== 'PDF') {
      throw new MissingReferencesError({
        assets: [input.assetId],
        reason: 'A apostila precisa apontar para um arquivo PDF.',
      });
    }

    return this.prisma.workbook.create({
      data: {
        unitId: input.unitId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        order: input.order,
        assetId: input.assetId,
      },
    });
  }

  async transitionWorkbook(id: string, action: ContentAction) {
    const workbook = await this.prisma.workbook.findUnique({
      where: { id },
      select: { status: true },
    });

    if (workbook === null) {
      throw new NotFoundError('Não encontramos esta apostila.');
    }

    const target = nextStatus(workbook.status, action);

    if (target === null) {
      throw new InvalidTransitionError(workbook.status, action);
    }

    const updated = await this.prisma.workbook.update({
      where: { id },
      data: { status: target },
    });

    await this.cache.invalidateLists();

    return updated;
  }

  /** Conteúdo publicado não se edita no lugar. */
  assertEditable(status: ContentStatus, action = 'editar'): void {
    if (!isEditable(status)) {
      throw new InvalidTransitionError(status, action);
    }
  }

  // -------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------

  private async assertSlugFree(
    entity: 'course' | 'unit' | 'character' | 'workbook',
    slug: string,
  ): Promise<void> {
    const found = await (entity === 'course'
      ? this.prisma.course.findUnique({ where: { slug }, select: { id: true } })
      : entity === 'unit'
        ? this.prisma.unit.findUnique({ where: { slug }, select: { id: true } })
        : entity === 'character'
          ? this.prisma.character.findUnique({
              where: { slug },
              select: { id: true },
            })
          : this.prisma.workbook.findUnique({
              where: { slug },
              select: { id: true },
            }));

    if (found !== null) {
      throw new SlugInUseError(slug);
    }
  }

  private async assertCharactersExist(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const found = new Set(await this.existingCharacterIds(ids));
    const missing = ids.filter((id) => !found.has(id));

    if (missing.length > 0) {
      throw new MissingReferencesError({ characters: missing });
    }
  }

  private async syncCast(
    tx: Prisma.TransactionClient,
    unitId: string,
    characterIds: readonly string[],
  ): Promise<void> {
    if (characterIds.length === 0) {
      return;
    }

    await tx.unitCharacter.createMany({
      data: characterIds.map((characterId) => ({ unitId, characterId })),
      skipDuplicates: true,
    });
  }
}
