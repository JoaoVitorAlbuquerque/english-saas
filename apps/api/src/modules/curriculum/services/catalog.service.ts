import { Injectable } from '@nestjs/common';
import { ContentStatus, type CefrLevel } from '@prisma/client';
import type { LessonStepInput, Paginated } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import { collectStepReferences } from '../domain/references';
import { toStudentItem } from '../domain/student-view';
import { AssetUrlService, type ResolvedAsset } from './asset-url.service';
import { CatalogCacheService } from './catalog-cache.service';

/**
 * O catálogo que o aluno vê.
 *
 * Só conteúdo PUBLISHED sai daqui, e o gabarito das questões fica para trás
 * (`toStudentItem`). O que é guardado em cache tem `storageKey`; a URL
 * assinada nasce na resposta.
 */

/** A lição como ela vai para o cache: chaves de storage, sem URL. */
type CachedLesson = {
  id: string;
  slug: string;
  order: number;
  version: number;
  title: string;
  objective: string;
  cefrLevel: CefrLevel;
  estimatedMinutes: number;
  publishedAt: string | null;
  unit: { id: string; slug: string; title: string; order: number };
  level: { cefrLevel: CefrLevel; title: string };
  targetSkills: {
    id: string;
    title: string;
    type: string;
    competency: string;
    cefrLevel: CefrLevel;
  }[];
  characters: {
    id: string;
    slug: string;
    name: string;
    bio: string | null;
    avatarAssetId: string | null;
  }[];
  registerNotes: {
    id: string;
    spokenForm: string;
    standardForm: string;
    register: string;
    explanation: string;
    whenToAvoid: string | null;
    audioAssetId: string | null;
  }[];
  items: ReturnType<typeof toStudentItem>[];
  steps: ({ order: number } & LessonStepInput)[];
  assetIds: string[];
};

export type CatalogLesson = Omit<CachedLesson, 'assetIds'> & {
  assets: Record<string, ResolvedAsset>;
};

export type OutlineStep = {
  index: number;
  type: LessonStepInput['type'];
  /** Só em PRACTICE; vazio nas outras. */
  itemIds: string[];
};

export type PublishedOutline = {
  lessonId: string;
  slug: string;
  versionId: string;
  version: number;
  title: string;
  steps: OutlineStep[];
};

function outlineSteps(
  steps: readonly { type: string; content: unknown }[],
): OutlineStep[] {
  return steps.map((step, index) => {
    const content = step.content as { itemIds?: unknown } | null;
    const itemIds =
      step.type === 'PRACTICE' && Array.isArray(content?.itemIds)
        ? content.itemIds.filter((id): id is string => typeof id === 'string')
        : [];

    return {
      index,
      type: step.type as LessonStepInput['type'],
      itemIds,
    };
  });
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly cache: CatalogCacheService,
  ) {}

  // -------------------------------------------------------------------
  // Estrutura
  // -------------------------------------------------------------------

  async listLevels() {
    const key = this.cache.listKey('levels');
    const cached = await this.cache.get<unknown[]>(key);

    if (cached !== undefined) {
      return cached;
    }

    const levels = await this.prisma.level.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        cefrLevel: true,
        title: true,
        description: true,
        objectives: true,
        order: true,
        course: { select: { slug: true, title: true, language: true } },
        _count: { select: { units: true } },
      },
    });

    const payload = levels.map((level) => ({
      ...level,
      unitCount: level._count.units,
      _count: undefined,
    }));

    await this.cache.set(key, payload);

    return payload;
  }

  async listUnits(query: {
    cursor?: string | undefined;
    limit: number;
    level?: CefrLevel | undefined;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const units = await this.prisma.unit.findMany({
      take,
      ...cursorArgs,
      where: {
        status: ContentStatus.PUBLISHED,
        ...(query.level === undefined
          ? {}
          : { level: { cefrLevel: query.level } }),
      },
      orderBy: { id: 'asc' },
      select: this.unitSelect(),
    });

    const page = buildPage(units, query.limit, (unit) => unit.id);

    return { ...page, data: await this.decorateUnits(page.data) };
  }

  async findUnitBySlug(slug: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED },
      select: this.unitSelect(),
    });

    if (unit === null) {
      throw new NotFoundError('Não encontramos esta unidade.');
    }

    const [decorated] = await this.decorateUnits([unit]);

    if (decorated === undefined) {
      throw new NotFoundError('Não encontramos esta unidade.');
    }

    return decorated;
  }

  // -------------------------------------------------------------------
  // Lição
  // -------------------------------------------------------------------

  async findLessonBySlug(slug: string): Promise<CatalogLesson> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { slug },
      select: { publishedVersionId: true },
    });

    if (lesson?.publishedVersionId == null) {
      throw new NotFoundError('Esta lição ainda não está disponível.');
    }

    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lesson.publishedVersionId },
      select: { version: true },
    });

    if (version === null) {
      throw new NotFoundError('Esta lição ainda não está disponível.');
    }

    const key = this.cache.lessonKey(slug, version.version);
    const cached =
      (await this.cache.get<CachedLesson>(key)) ??
      (await this.buildLesson(lesson.publishedVersionId, key));

    return this.signLesson(cached);
  }

  /**
   * Esqueleto da versão publicada de uma lição, para o player (6).
   *
   * `index` é a posição da etapa na ordem da lição, começando em 0 — é o
   * número que o aluno manda em `/attempts/:id/steps/:index/complete`.
   * Só as etapas PRACTICE carregam `itemIds`.
   */
  async findPublishedOutline(lessonId: string): Promise<PublishedOutline> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        slug: true,
        publishedVersion: {
          select: {
            id: true,
            version: true,
            title: true,
            steps: {
              orderBy: { order: 'asc' },
              select: { type: true, content: true },
            },
          },
        },
      },
    });

    if (lesson?.publishedVersion == null) {
      throw new NotFoundError('Esta lição ainda não está disponível.');
    }

    const version = lesson.publishedVersion;

    return {
      lessonId: lesson.id,
      slug: lesson.slug,
      versionId: version.id,
      version: version.version,
      title: version.title,
      steps: outlineSteps(version.steps),
    };
  }

  /**
   * O mesmo esqueleto, mas de uma versão específica — a de uma tentativa,
   * que pode já não ser a publicada.
   */
  async findVersionOutline(versionId: string): Promise<PublishedOutline> {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        version: true,
        title: true,
        lesson: { select: { id: true, slug: true } },
        steps: {
          orderBy: { order: 'asc' },
          select: { type: true, content: true },
        },
      },
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    return {
      lessonId: version.lesson.id,
      slug: version.lesson.slug,
      versionId: version.id,
      version: version.version,
      title: version.title,
      steps: outlineSteps(version.steps),
    };
  }

  /** Título e slug de várias versões. O histórico do aluno usa. */
  async versionSummaries(versionIds: readonly string[]) {
    if (versionIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.lessonVersion.findMany({
      where: { id: { in: [...versionIds] } },
      select: {
        id: true,
        version: true,
        title: true,
        cefrLevel: true,
        lesson: { select: { slug: true } },
      },
    });

    return rows.map((row) => ({
      versionId: row.id,
      version: row.version,
      title: row.title,
      cefrLevel: row.cefrLevel,
      lessonSlug: row.lesson.slug,
    }));
  }

  /**
   * Questões avulsas como o aluno as vê — **sem gabarito** — com o áudio
   * das de escuta assinado agora. O assessment (8) entrega questão por
   * questão fora de uma lição; o SRS (9) vai fazer o mesmo.
   */
  async studentItems(ids: readonly string[]) {
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
        cefrLevel: true,
        skills: { orderBy: { position: 'asc' }, select: { skillId: true } },
      },
    });

    const audioIds = rows.flatMap((row) => {
      const assetId = (row.content as { audioAssetId?: unknown } | null)
        ?.audioAssetId;
      return typeof assetId === 'string' ? [assetId] : [];
    });

    const assets = await this.assets.resolveMap(
      audioIds.length === 0
        ? []
        : await this.prisma.mediaAsset.findMany({
            where: { id: { in: audioIds } },
            select: {
              id: true,
              kind: true,
              storageKey: true,
              mimeType: true,
              durationMs: true,
            },
          }),
    );

    const byId = new Map(
      rows.map((row) => [
        row.id,
        {
          ...toStudentItem({
            id: row.id,
            type: row.type,
            prompt: row.prompt,
            content: row.content,
            cefrLevel: row.cefrLevel,
            skillIds: row.skills.map((skill) => skill.skillId),
          }),
          assets,
        },
      ]),
    );

    // Na ordem pedida, não na do banco.
    return ids.flatMap((id) => {
      const item = byId.get(id);
      return item === undefined ? [] : [item];
    });
  }

  /**
   * As skills que as lições publicadas de uma unidade ensinam, e o nível
   * da unidade. É o que o checkpoint de unidade (8) cobra.
   */
  async unitTargetSkills(unitId: string): Promise<{
    unitId: string;
    cefrLevel: CefrLevel;
    skillIds: string[];
  }> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        status: true,
        level: { select: { cefrLevel: true } },
        lessons: {
          where: { publishedVersionId: { not: null } },
          orderBy: { order: 'asc' },
          select: {
            publishedVersion: {
              select: {
                targetSkills: {
                  orderBy: { position: 'asc' },
                  select: { skillId: true },
                },
              },
            },
          },
        },
      },
    });

    if (unit === null || unit.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundError('Esta unidade ainda não está disponível.');
    }

    return {
      unitId: unit.id,
      cefrLevel: unit.level.cefrLevel,
      skillIds: [
        ...new Set(
          unit.lessons.flatMap(
            (lesson) =>
              lesson.publishedVersion?.targetSkills.map(
                (target) => target.skillId,
              ) ?? [],
          ),
        ),
      ],
    };
  }

  /**
   * O que uma versão de lição toca: as skills-alvo dela e tudo que as
   * etapas referenciam (inclui vocabulário e chunk, que são `Skill` também).
   * O SRS (9) usa para criar os cards de revisão ao completar a lição.
   */
  async lessonVersionOutline(lessonVersionId: string): Promise<{
    targetSkillIds: string[];
    referencedSkillIds: string[];
    registerNoteIds: string[];
  }> {
    const version = await this.prisma.lessonVersion.findUniqueOrThrow({
      where: { id: lessonVersionId },
      select: {
        steps: {
          orderBy: { order: 'asc' },
          select: { order: true, type: true, content: true },
        },
        targetSkills: { select: { skillId: true } },
      },
    });

    const steps = version.steps as ({ order: number } & LessonStepInput)[];
    const references = collectStepReferences(steps);

    return {
      targetSkillIds: version.targetSkills.map((target) => target.skillId),
      referencedSkillIds: references.skillIds,
      registerNoteIds: references.registerNoteIds,
    };
  }

  /** Monta a lição a partir do banco e guarda no cache. */
  private async buildLesson(
    versionId: string,
    cacheKey: string,
  ): Promise<CachedLesson> {
    const version = await this.prisma.lessonVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: {
        version: true,
        title: true,
        objective: true,
        cefrLevel: true,
        estimatedMinutes: true,
        publishedAt: true,
        lesson: {
          select: {
            id: true,
            slug: true,
            order: true,
            unit: {
              select: {
                id: true,
                slug: true,
                title: true,
                order: true,
                level: { select: { cefrLevel: true, title: true } },
              },
            },
          },
        },
        steps: {
          orderBy: { order: 'asc' },
          select: { order: true, type: true, content: true },
        },
        targetSkills: {
          orderBy: { position: 'asc' },
          select: {
            skill: {
              select: {
                id: true,
                title: true,
                type: true,
                competency: true,
                cefrLevel: true,
              },
            },
          },
        },
      },
    });

    const steps = version.steps.map((step) => ({
      order: step.order,
      type: step.type,
      content: step.content,
    })) as ({ order: number } & LessonStepInput)[];

    const references = collectStepReferences(steps);

    const [characters, registerNotes, items] = await Promise.all([
      this.prisma.character.findMany({
        where: { id: { in: references.characterIds } },
        select: {
          id: true,
          slug: true,
          name: true,
          bio: true,
          avatarAssetId: true,
        },
      }),
      this.prisma.registerNote.findMany({
        where: { id: { in: references.registerNoteIds } },
        select: {
          id: true,
          spokenForm: true,
          standardForm: true,
          register: true,
          explanation: true,
          whenToAvoid: true,
          audioAssetId: true,
        },
      }),
      this.prisma.item.findMany({
        where: { id: { in: references.itemIds } },
        select: {
          id: true,
          type: true,
          prompt: true,
          content: true,
          cefrLevel: true,
          skills: {
            orderBy: { position: 'asc' },
            select: { skillId: true },
          },
        },
      }),
    ]);

    const assetIds = [
      ...new Set([
        ...references.assetIds,
        ...characters.flatMap((c) =>
          c.avatarAssetId === null ? [] : [c.avatarAssetId],
        ),
        ...registerNotes.flatMap((n) =>
          n.audioAssetId === null ? [] : [n.audioAssetId],
        ),
      ]),
    ];

    const payload: CachedLesson = {
      id: version.lesson.id,
      slug: version.lesson.slug,
      order: version.lesson.order,
      version: version.version,
      title: version.title,
      objective: version.objective,
      cefrLevel: version.cefrLevel,
      estimatedMinutes: version.estimatedMinutes,
      publishedAt: version.publishedAt?.toISOString() ?? null,
      unit: {
        id: version.lesson.unit.id,
        slug: version.lesson.unit.slug,
        title: version.lesson.unit.title,
        order: version.lesson.unit.order,
      },
      level: version.lesson.unit.level,
      targetSkills: version.targetSkills.map((target) => target.skill),
      characters,
      registerNotes,
      items: items.map((item) =>
        toStudentItem({
          id: item.id,
          type: item.type,
          prompt: item.prompt,
          content: item.content,
          cefrLevel: item.cefrLevel,
          skillIds: item.skills.map((skill) => skill.skillId),
        }),
      ),
      steps,
      assetIds,
    };

    await this.cache.set(cacheKey, payload);

    return payload;
  }

  /** Troca os ids de asset por URLs assinadas agora. */
  private async signLesson(lesson: CachedLesson): Promise<CatalogLesson> {
    const { assetIds, ...rest } = lesson;

    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: assetIds } },
      select: {
        id: true,
        kind: true,
        storageKey: true,
        mimeType: true,
        durationMs: true,
      },
    });

    return { ...rest, assets: await this.assets.resolveMap(rows) };
  }

  // -------------------------------------------------------------------
  // Taxonomia
  // -------------------------------------------------------------------

  async listSkills(query: {
    cursor?: string | undefined;
    limit: number;
    level?: CefrLevel | undefined;
    competency?: string | undefined;
    type?: string | undefined;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const skills = await this.prisma.skill.findMany({
      take,
      ...cursorArgs,
      where: {
        deprecatedAt: null,
        ...(query.level === undefined ? {} : { cefrLevel: query.level }),
        ...(query.competency === undefined
          ? {}
          : { competency: query.competency as never }),
        ...(query.type === undefined ? {} : { type: query.type as never }),
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        type: true,
        competency: true,
        cefrLevel: true,
        title: true,
        description: true,
        prerequisites: { select: { prerequisiteId: true } },
        commonErrors: { select: { errorPatternId: true } },
      },
    });

    const page = buildPage(skills, query.limit, (skill) => skill.id);

    return {
      ...page,
      data: page.data.map((skill) => ({
        ...skill,
        prerequisites: skill.prerequisites.map((p) => p.prerequisiteId),
        commonErrors: skill.commonErrors.map((e) => e.errorPatternId),
      })),
    };
  }

  async listRegisterNotes(query: {
    cursor?: string | undefined;
    limit: number;
    level?: CefrLevel | undefined;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const notes = await this.prisma.registerNote.findMany({
      take,
      ...cursorArgs,
      where: {
        deprecatedAt: null,
        ...(query.level === undefined ? {} : { cefrLevel: query.level }),
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        spokenForm: true,
        standardForm: true,
        register: true,
        explanation: true,
        whenToAvoid: true,
        cefrLevel: true,
        skillId: true,
        audioAsset: {
          select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            durationMs: true,
          },
        },
      },
    });

    const page = buildPage(notes, query.limit, (note) => note.id);
    const audios = page.data.flatMap((note) =>
      note.audioAsset === null ? [] : [note.audioAsset],
    );
    const resolved = await this.assets.resolveMap(audios);

    return {
      ...page,
      data: page.data.map(({ audioAsset, ...note }) => ({
        ...note,
        audio: audioAsset === null ? null : (resolved[audioAsset.id] ?? null),
      })),
    };
  }

  async listCharacters() {
    const characters = await this.prisma.character.findMany({
      orderBy: { slug: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        bio: true,
        avatarAsset: {
          select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            durationMs: true,
          },
        },
      },
    });

    const avatars = characters.flatMap((character) =>
      character.avatarAsset === null ? [] : [character.avatarAsset],
    );
    const resolved = await this.assets.resolveMap(avatars);

    return characters.map(({ avatarAsset, ...character }) => ({
      ...character,
      avatar: avatarAsset === null ? null : (resolved[avatarAsset.id] ?? null),
    }));
  }

  // -------------------------------------------------------------------
  // Apostilas
  // -------------------------------------------------------------------

  async listWorkbooks(query: { level?: CefrLevel | undefined }) {
    const workbooks = await this.prisma.workbook.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        ...(query.level === undefined
          ? {}
          : { unit: { level: { cefrLevel: query.level } } }),
      },
      orderBy: [{ unit: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        order: true,
        unit: {
          select: {
            id: true,
            slug: true,
            title: true,
            level: { select: { cefrLevel: true } },
          },
        },
        asset: {
          select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            durationMs: true,
          },
        },
      },
    });

    const resolved = await this.assets.resolveMap(
      workbooks.map((workbook) => workbook.asset),
    );

    return workbooks.map(({ asset, ...workbook }) => ({
      ...workbook,
      file: resolved[asset.id] ?? null,
    }));
  }

  // -------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------

  private unitSelect() {
    return {
      id: true,
      slug: true,
      order: true,
      title: true,
      synopsis: true,
      coverAssetId: true,
      level: { select: { cefrLevel: true, title: true } },
      cast: {
        select: {
          character: {
            select: {
              id: true,
              slug: true,
              name: true,
              bio: true,
              avatarAssetId: true,
            },
          },
        },
      },
      lessons: {
        where: { publishedVersionId: { not: null } },
        orderBy: { order: 'asc' as const },
        select: {
          id: true,
          slug: true,
          order: true,
          publishedVersion: {
            select: {
              version: true,
              title: true,
              objective: true,
              cefrLevel: true,
              estimatedMinutes: true,
            },
          },
        },
      },
    };
  }

  /** Resolve capa e avatares das unidades numa tacada. */
  private async decorateUnits<
    T extends {
      coverAssetId: string | null;
      cast: { character: { avatarAssetId: string | null } }[];
    },
  >(units: T[]) {
    const assetIds = [
      ...new Set(
        units.flatMap((unit) => [
          ...(unit.coverAssetId === null ? [] : [unit.coverAssetId]),
          ...unit.cast.flatMap((entry) =>
            entry.character.avatarAssetId === null
              ? []
              : [entry.character.avatarAssetId],
          ),
        ]),
      ),
    ];

    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: assetIds } },
      select: {
        id: true,
        kind: true,
        storageKey: true,
        mimeType: true,
        durationMs: true,
      },
    });

    const resolved = await this.assets.resolveMap(rows);

    return units.map(({ coverAssetId, cast, ...unit }) => ({
      ...unit,
      cover: coverAssetId === null ? null : (resolved[coverAssetId] ?? null),
      cast: cast.map(({ character }) => {
        const { avatarAssetId, ...rest } = character;

        return {
          ...rest,
          avatar:
            avatarAssetId === null ? null : (resolved[avatarAssetId] ?? null),
        };
      }),
    }));
  }
}
