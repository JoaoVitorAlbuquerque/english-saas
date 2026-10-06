import { Injectable } from '@nestjs/common';
import type {
  CefrLevel,
  Competency,
  LearningGoal,
  MediaKind,
  Prisma,
  RegisterLevel,
  SkillType,
} from '@prisma/client';
import type { Paginated } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import {
  buildPage,
  decodeCursor,
  toPrismaCursorArgs,
} from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  InvalidPrerequisitesError,
  MissingReferencesError,
  RegisterSkillTakenError,
  SlugInUseError,
  TaxonomySlugIsImmutableError,
} from '../curriculum.errors';
import { matchesSearch } from '../domain/search';
import { findPrerequisiteCycle } from '../domain/skill-graph';

import { AssetUrlService } from './asset-url.service';

/**
 * Autoria da taxonomia: Skill, ErrorPattern e RegisterNote.
 *
 * As três têm slug como chave primária, e slug **não se renomeia**: id já
 * publicado vive dentro de JSON de lição e do modelo do aluno. Para tirar um
 * de circulação, `deprecate()` marca a data e aponta o substituto.
 */

export type SkillInput = {
  id: string;
  type: SkillType;
  competency: Competency;
  cefrLevel: CefrLevel;
  title: string;
  description?: string | null;
  prerequisites?: string[];
  commonErrors?: string[];
  goals?: LearningGoal[];
};

/** Uma skill como o modelo do aluno (7) enxerga: o grafo, sem autoria. */
export type SkillGraphNode = {
  id: string;
  title: string;
  type: SkillType;
  competency: Competency;
  cefrLevel: CefrLevel;
  goals: LearningGoal[];
  prerequisiteIds: string[];
  /** De quantas skills esta é pré-requisito. */
  requiredByCount: number;
  errorPatternIds: string[];
};

export type ErrorPatternInput = {
  id: string;
  description: string;
  example: string;
  correction: string;
  explanation: string;
  skillIds?: string[];
};

export type RegisterNoteInput = {
  id: string;
  spokenForm: string;
  standardForm: string;
  register: RegisterLevel;
  explanation: string;
  whenToAvoid?: string | null;
  cefrLevel: CefrLevel;
  skillId?: string | null;
  audioAssetId?: string | null;
};

const skillSelect = {
  id: true,
  type: true,
  competency: true,
  cefrLevel: true,
  title: true,
  description: true,
  goals: true,
  deprecatedAt: true,
  replacedById: true,
  createdAt: true,
  updatedAt: true,
  prerequisites: { select: { prerequisiteId: true } },
  commonErrors: { select: { errorPatternId: true } },
} satisfies Prisma.SkillSelect;

/** Mesmo contrato de `skillSelect`, para erro típico. */
const errorPatternSelect = {
  id: true,
  description: true,
  example: true,
  correction: true,
  explanation: true,
  deprecatedAt: true,
  replacedById: true,
  skills: { select: { skillId: true } },
} satisfies Prisma.ErrorPatternSelect;

const registerNoteSelect = {
  id: true,
  spokenForm: true,
  standardForm: true,
  register: true,
  explanation: true,
  whenToAvoid: true,
  cefrLevel: true,
  skillId: true,
  audioAssetId: true,
  deprecatedAt: true,
  replacedById: true,
  createdAt: true,
  updatedAt: true,
  audioAsset: {
    select: {
      id: true,
      kind: true,
      storageKey: true,
      mimeType: true,
      durationMs: true,
    },
  },
} satisfies Prisma.RegisterNoteSelect;

type ListQuery = {
  cursor?: string | undefined;
  limit: number;
  includeDeprecated?: boolean | undefined;
  q?: string | undefined;
};

@Injectable()
export class TaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
  ) {}

  // -------------------------------------------------------------------
  // Skill
  // -------------------------------------------------------------------

  async listSkills(
    query: ListQuery & {
      level?: CefrLevel | undefined;
      competency?: Competency | undefined;
      type?: SkillType | undefined;
    },
  ): Promise<Paginated<unknown>> {
    const where: Prisma.SkillWhereInput = {
      ...(query.includeDeprecated === true ? {} : { deprecatedAt: null }),
      ...(query.level === undefined ? {} : { cefrLevel: query.level }),
      ...(query.competency === undefined
        ? {}
        : { competency: query.competency }),
      ...(query.type === undefined ? {} : { type: query.type }),
    };

    if (query.q !== undefined) {
      const rows = await this.prisma.skill.findMany({
        where,
        orderBy: { id: 'asc' },
        select: skillSelect,
      });
      const q = query.q;
      const page = this.pageInMemory(rows, query, (row) =>
        matchesSearch([row.id, row.title], q),
      );

      return { ...page, data: page.data.map((row) => this.flattenSkill(row)) };
    }

    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.skill.findMany({
      take,
      ...cursorArgs,
      where,
      orderBy: { id: 'asc' },
      select: skillSelect,
    });

    const page = buildPage(rows, query.limit, (row) => row.id);

    return { ...page, data: page.data.map((row) => this.flattenSkill(row)) };
  }

  /**
   * Busca por texto sem acento nem caixa: lê o conjunto inteiro e filtra em
   * memória (ver `domain/search.ts`; a taxonomia é pequena), paginando pelo
   * mesmo cursor opaco da listagem comum.
   */
  private pageInMemory<T extends { id: string }>(
    rows: readonly T[],
    query: { cursor?: string | undefined; limit: number },
    matches: (row: T) => boolean,
  ): Paginated<T> {
    const matching = rows.filter(matches);
    const after =
      query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const start =
      after === undefined
        ? 0
        : matching.findIndex((row) => row.id === after) + 1;

    return buildPage(
      matching.slice(start, start + query.limit + 1),
      query.limit,
      (row) => row.id,
    );
  }

  async findSkill(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      select: skillSelect,
    });

    if (skill === null) {
      throw new NotFoundError('Não encontramos esta skill.');
    }

    return this.flattenSkill(skill);
  }

  async createSkill(input: SkillInput) {
    const existing = await this.prisma.skill.findUnique({
      where: { id: input.id },
      select: { id: true },
    });

    if (existing !== null) {
      throw new SlugInUseError(input.id);
    }

    // A auto-referência vem antes da existência: a skill ainda não existe.
    await this.assertPrerequisitesValid(input.id, input.prerequisites ?? []);
    await this.assertSkillsExist(input.prerequisites ?? []);
    await this.assertErrorPatternsExist(input.commonErrors ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.skill.create({
        data: {
          id: input.id,
          type: input.type,
          competency: input.competency,
          cefrLevel: input.cefrLevel,
          title: input.title,
          description: input.description ?? null,
          goals: input.goals ?? [],
        },
      });

      await this.syncSkillLinks(tx, input.id, input);
    });

    return this.findSkill(input.id);
  }

  async updateSkill(id: string, input: Partial<SkillInput>) {
    if (input.id !== undefined && input.id !== id) {
      throw new TaxonomySlugIsImmutableError(id);
    }

    const current = await this.findSkill(id);

    await this.assertSkillsExist(input.prerequisites ?? []);

    if (input.prerequisites !== undefined) {
      await this.assertPrerequisitesValid(
        id,
        input.prerequisites,
        current.prerequisites,
      );
    }

    await this.assertErrorPatternsExist(input.commonErrors ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.skill.update({
        where: { id },
        data: {
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.competency === undefined
            ? {}
            : { competency: input.competency }),
          ...(input.cefrLevel === undefined
            ? {}
            : { cefrLevel: input.cefrLevel }),
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.goals === undefined ? {} : { goals: input.goals }),
        },
      });

      await this.syncSkillLinks(tx, id, input);
    });

    return this.findSkill(id);
  }

  /** Tira de circulação sem renomear. O substituto é opcional. */
  async deprecateSkill(id: string, replacedById?: string | null) {
    await this.findSkill(id);

    if (replacedById != null) {
      if (replacedById === id) {
        throw new MissingReferencesError({
          skills: [replacedById],
          reason: 'Uma skill não pode substituir a si mesma.',
        });
      }

      await this.assertSkillsExist([replacedById]);

      const replacement = await this.prisma.skill.findUnique({
        where: { id: replacedById },
        select: { deprecatedAt: true },
      });

      if (replacement?.deprecatedAt != null) {
        throw new MissingReferencesError({
          skills: [replacedById],
          reason: 'A skill substituta já está obsoleta.',
        });
      }
    }

    await this.prisma.skill.update({
      where: { id },
      data: { deprecatedAt: new Date(), replacedById: replacedById ?? null },
    });

    return this.findSkill(id);
  }

  // -------------------------------------------------------------------
  // ErrorPattern
  // -------------------------------------------------------------------

  async listErrorPatterns(
    query: ListQuery & { skillId?: string | undefined },
  ): Promise<Paginated<unknown>> {
    const where: Prisma.ErrorPatternWhereInput = {
      ...(query.includeDeprecated === true ? {} : { deprecatedAt: null }),
      ...(query.skillId === undefined
        ? {}
        : { skills: { some: { skillId: query.skillId } } }),
    };
    const flatten = <T extends { skills: { skillId: string }[] }>(row: T) => {
      const { skills, ...rest } = row;

      return { ...rest, skillIds: skills.map((link) => link.skillId) };
    };

    if (query.q !== undefined) {
      const rows = await this.prisma.errorPattern.findMany({
        where,
        orderBy: { id: 'asc' },
        select: errorPatternSelect,
      });
      const q = query.q;
      const page = this.pageInMemory(rows, query, (row) =>
        matchesSearch(
          [row.id, row.description, row.example, row.correction],
          q,
        ),
      );

      return { ...page, data: page.data.map(flatten) };
    }

    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.errorPattern.findMany({
      take,
      ...cursorArgs,
      where,
      orderBy: { id: 'asc' },
      select: errorPatternSelect,
    });

    const page = buildPage(rows, query.limit, (row) => row.id);

    return { ...page, data: page.data.map(flatten) };
  }

  async findErrorPattern(id: string) {
    const pattern = await this.prisma.errorPattern.findUnique({
      where: { id },
      select: errorPatternSelect,
    });

    if (pattern === null) {
      throw new NotFoundError('Não encontramos este padrão de erro.');
    }

    const { skills, ...rest } = pattern;

    return { ...rest, skillIds: skills.map((link) => link.skillId) };
  }

  /** Tira de circulação sem renomear. O substituto é opcional. */
  async deprecateErrorPattern(id: string, replacedById?: string | null) {
    await this.findErrorPattern(id);

    if (replacedById != null) {
      await this.assertReplacement('errorPatterns', id, replacedById);
    }

    await this.prisma.errorPattern.update({
      where: { id },
      data: { deprecatedAt: new Date(), replacedById: replacedById ?? null },
    });

    return this.findErrorPattern(id);
  }

  async createErrorPattern(input: ErrorPatternInput) {
    const existing = await this.prisma.errorPattern.findUnique({
      where: { id: input.id },
      select: { id: true },
    });

    if (existing !== null) {
      throw new SlugInUseError(input.id);
    }

    await this.assertSkillsExist(input.skillIds ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.errorPattern.create({
        data: {
          id: input.id,
          description: input.description,
          example: input.example,
          correction: input.correction,
          explanation: input.explanation,
        },
      });

      await this.linkErrorPatternSkills(tx, input.id, input.skillIds ?? []);
    });

    return this.findErrorPattern(input.id);
  }

  async updateErrorPattern(id: string, input: Partial<ErrorPatternInput>) {
    if (input.id !== undefined && input.id !== id) {
      throw new TaxonomySlugIsImmutableError(id);
    }

    await this.findErrorPattern(id);
    await this.assertSkillsExist(input.skillIds ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.errorPattern.update({
        where: { id },
        data: {
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.example === undefined ? {} : { example: input.example }),
          ...(input.correction === undefined
            ? {}
            : { correction: input.correction }),
          ...(input.explanation === undefined
            ? {}
            : { explanation: input.explanation }),
        },
      });

      if (input.skillIds !== undefined) {
        await tx.skillErrorPattern.deleteMany({
          where: { errorPatternId: id },
        });
        await this.linkErrorPatternSkills(tx, id, input.skillIds);
      }
    });

    return this.findErrorPattern(id);
  }

  // -------------------------------------------------------------------
  // RegisterNote
  // -------------------------------------------------------------------

  async listRegisterNotes(
    query: ListQuery & {
      level?: CefrLevel | undefined;
      register?: RegisterLevel | undefined;
      skillId?: string | undefined;
    },
  ): Promise<Paginated<unknown>> {
    const where: Prisma.RegisterNoteWhereInput = {
      ...(query.includeDeprecated === true ? {} : { deprecatedAt: null }),
      ...(query.level === undefined ? {} : { cefrLevel: query.level }),
      ...(query.register === undefined ? {} : { register: query.register }),
      ...(query.skillId === undefined ? {} : { skillId: query.skillId }),
    };

    if (query.q !== undefined) {
      const rows = await this.prisma.registerNote.findMany({
        where,
        orderBy: { id: 'asc' },
        select: registerNoteSelect,
      });
      const q = query.q;
      const page = this.pageInMemory(rows, query, (row) =>
        matchesSearch([row.id, row.spokenForm, row.standardForm], q),
      );

      return { ...page, data: await this.withAudio(page.data) };
    }

    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.registerNote.findMany({
      take,
      ...cursorArgs,
      where,
      orderBy: { id: 'asc' },
      select: registerNoteSelect,
    });

    const page = buildPage(rows, query.limit, (row) => row.id);

    return { ...page, data: await this.withAudio(page.data) };
  }

  async findRegisterNote(id: string) {
    const note = await this.prisma.registerNote.findUnique({
      where: { id },
      select: registerNoteSelect,
    });

    if (note === null) {
      throw new NotFoundError('Não encontramos esta nota de registro.');
    }

    const [withAudio] = await this.withAudio([note]);

    return withAudio as NonNullable<typeof withAudio>;
  }

  async createRegisterNote(input: RegisterNoteInput) {
    const existing = await this.prisma.registerNote.findUnique({
      where: { id: input.id },
      select: { id: true },
    });

    if (existing !== null) {
      throw new SlugInUseError(input.id);
    }

    await this.assertRegisterSkill(input.skillId);
    await this.assertSkillFree(input.skillId, input.id);
    await this.assertAudioAsset(input.audioAssetId);

    await this.prisma.registerNote.create({
      data: {
        id: input.id,
        spokenForm: input.spokenForm,
        standardForm: input.standardForm,
        register: input.register,
        explanation: input.explanation,
        whenToAvoid: input.whenToAvoid ?? null,
        cefrLevel: input.cefrLevel,
        skillId: input.skillId ?? null,
        audioAssetId: input.audioAssetId ?? null,
      },
    });

    return this.findRegisterNote(input.id);
  }

  async updateRegisterNote(id: string, input: Partial<RegisterNoteInput>) {
    if (input.id !== undefined && input.id !== id) {
      throw new TaxonomySlugIsImmutableError(id);
    }

    await this.findRegisterNote(id);

    if (input.skillId !== undefined) {
      await this.assertRegisterSkill(input.skillId);
      await this.assertSkillFree(input.skillId, id);
    }

    await this.assertAudioAsset(input.audioAssetId);

    await this.prisma.registerNote.update({
      where: { id },
      data: {
        ...(input.spokenForm === undefined
          ? {}
          : { spokenForm: input.spokenForm }),
        ...(input.standardForm === undefined
          ? {}
          : { standardForm: input.standardForm }),
        ...(input.register === undefined ? {} : { register: input.register }),
        ...(input.explanation === undefined
          ? {}
          : { explanation: input.explanation }),
        ...(input.whenToAvoid === undefined
          ? {}
          : { whenToAvoid: input.whenToAvoid }),
        ...(input.cefrLevel === undefined
          ? {}
          : { cefrLevel: input.cefrLevel }),
        ...(input.skillId === undefined ? {} : { skillId: input.skillId }),
        ...(input.audioAssetId === undefined
          ? {}
          : { audioAssetId: input.audioAssetId }),
      },
    });

    return this.findRegisterNote(id);
  }

  /** Tira de circulação sem renomear. O substituto é opcional. */
  async deprecateRegisterNote(id: string, replacedById?: string | null) {
    await this.findRegisterNote(id);

    if (replacedById != null) {
      await this.assertReplacement('registerNotes', id, replacedById);
    }

    await this.prisma.registerNote.update({
      where: { id },
      data: { deprecatedAt: new Date(), replacedById: replacedById ?? null },
    });

    return this.findRegisterNote(id);
  }

  // -------------------------------------------------------------------
  // Conferências
  // -------------------------------------------------------------------

  /** Quais desses ids de skill existem. Usado pelo publish da lição. */
  async existingSkillIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.skill.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async existingRegisterNoteIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.registerNote.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async existingErrorPatternIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.errorPattern.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  /**
   * O grafo de skills em circulação, para o modelo do aluno (7).
   *
   * Vem inteiro: a taxonomia tem dezenas de skills por nível, não milhares,
   * e as necessidades do aluno são calculadas sobre o conjunto.
   */
  async skillGraph(): Promise<SkillGraphNode[]> {
    const rows = await this.prisma.skill.findMany({
      where: { deprecatedAt: null },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        title: true,
        type: true,
        competency: true,
        cefrLevel: true,
        goals: true,
        prerequisites: { select: { prerequisiteId: true } },
        commonErrors: { select: { errorPatternId: true } },
        _count: { select: { requiredBy: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      competency: row.competency,
      cefrLevel: row.cefrLevel,
      goals: row.goals,
      prerequisiteIds: row.prerequisites.map((link) => link.prerequisiteId),
      requiredByCount: row._count.requiredBy,
      errorPatternIds: row.commonErrors.map((link) => link.errorPatternId),
    }));
  }

  /**
   * O que mostrar ao aluno sobre os erros típicos que a resposta dele
   * revelou. O player (6) usa no feedback da questão.
   */
  async errorPatternSummaries(ids: readonly string[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.errorPattern.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        description: true,
        correction: true,
        explanation: true,
      },
    });
  }

  /**
   * Catálogo de erros típicos em circulação, só id e descrição. É a lista
   * de onde o tutor (12) deixa a IA escolher — ela não pode inventar id.
   */
  async activeErrorPatterns(): Promise<{ id: string; description: string }[]> {
    return this.prisma.errorPattern.findMany({
      where: { deprecatedAt: null },
      orderBy: { id: 'asc' },
      select: { id: true, description: true },
    });
  }

  /** Título e descrição de skills, para o flashcard de vocab/chunk do SRS (9). */
  async skillsByIds(ids: readonly string[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.skill.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, title: true, description: true, type: true },
    });
  }

  /** Notas de registro em lote, para o flashcard do SRS (9). */
  async registerNotesByIds(ids: readonly string[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.registerNote.findMany({
      where: { id: { in: [...ids] } },
    });
  }

  /**
   * Skills ativas até um nível, para o generator (13) escolher alvos. Ordem
   * estável (nível, id): a escolha precisa ser determinística para o cache
   * do material base acertar.
   */
  async activeSkillsUpTo(levels: readonly CefrLevel[]) {
    if (levels.length === 0) {
      return [];
    }

    return this.prisma.skill.findMany({
      where: { deprecatedAt: null, cefrLevel: { in: [...levels] } },
      orderBy: [{ cefrLevel: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        type: true,
        competency: true,
        cefrLevel: true,
      },
    });
  }

  /** Notas de registro ativas destes níveis, em ordem estável. */
  async activeRegisterNotesAt(levels: readonly CefrLevel[]) {
    if (levels.length === 0) {
      return [];
    }

    return this.prisma.registerNote.findMany({
      where: { deprecatedAt: null, cefrLevel: { in: [...levels] } },
      orderBy: [{ cefrLevel: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        spokenForm: true,
        standardForm: true,
        explanation: true,
        cefrLevel: true,
      },
    });
  }

  private async assertSkillsExist(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const found = new Set(await this.existingSkillIds(ids));
    const missing = ids.filter((id) => !found.has(id));

    if (missing.length > 0) {
      throw new MissingReferencesError({ skills: missing });
    }
  }

  private async assertErrorPatternsExist(
    ids: readonly string[],
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const found = new Set(await this.existingErrorPatternIds(ids));
    const missing = ids.filter((id) => !found.has(id));

    if (missing.length > 0) {
      throw new MissingReferencesError({ errorPatterns: missing });
    }
  }

  /** A skill de uma RegisterNote precisa existir e ser do tipo REGISTER. */
  private async assertRegisterSkill(
    skillId: string | null | undefined,
  ): Promise<void> {
    if (skillId == null) {
      return;
    }

    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
      select: { type: true },
    });

    if (skill === null) {
      throw new MissingReferencesError({ skills: [skillId] });
    }

    if (skill.type !== 'REGISTER') {
      throw new MissingReferencesError({
        skills: [skillId],
        reason: 'A skill de uma nota de registro precisa ser do tipo REGISTER.',
      });
    }
  }

  /**
   * Os pré-requisitos propostos para `skillId` formam um grafo válido?
   * Recusa auto-referência, ciclo e skill obsoleta — esta só entre as que
   * entram agora (`current` são as que já estavam): quem já estava ligada
   * não trava a edição de outro campo.
   */
  private async assertPrerequisitesValid(
    skillId: string,
    prerequisiteIds: readonly string[],
    current: readonly string[] = [],
  ): Promise<void> {
    if (prerequisiteIds.length === 0) {
      return;
    }

    if (prerequisiteIds.includes(skillId)) {
      throw new InvalidPrerequisitesError('SELF', { skills: [skillId] });
    }

    const links = await this.prisma.skillPrerequisite.findMany({
      select: { skillId: true, prerequisiteId: true },
    });
    const edges = new Map<string, string[]>();

    for (const link of links) {
      edges.set(link.skillId, [
        ...(edges.get(link.skillId) ?? []),
        link.prerequisiteId,
      ]);
    }

    const cycle = findPrerequisiteCycle(skillId, prerequisiteIds, edges);

    if (cycle !== null) {
      throw new InvalidPrerequisitesError('CYCLE', {
        skills: [...new Set(cycle)],
        cycle,
      });
    }

    const entering = prerequisiteIds.filter((id) => !current.includes(id));
    const deprecated =
      entering.length === 0
        ? []
        : await this.prisma.skill.findMany({
            where: { id: { in: entering }, deprecatedAt: { not: null } },
            select: { id: true },
          });

    if (deprecated.length > 0) {
      throw new InvalidPrerequisitesError('DEPRECATED', {
        skills: deprecated.map((row) => row.id),
      });
    }
  }

  /** O substituto existe, não é o próprio e não está obsoleto. */
  private async assertReplacement(
    kind: 'errorPatterns' | 'registerNotes',
    id: string,
    replacedById: string,
  ): Promise<void> {
    if (replacedById === id) {
      throw new MissingReferencesError({
        [kind]: [replacedById],
        reason: 'Não dá para substituir por ele mesmo.',
      });
    }

    const row =
      kind === 'errorPatterns'
        ? await this.prisma.errorPattern.findUnique({
            where: { id: replacedById },
            select: { deprecatedAt: true },
          })
        : await this.prisma.registerNote.findUnique({
            where: { id: replacedById },
            select: { deprecatedAt: true },
          });

    if (row === null) {
      throw new MissingReferencesError({ [kind]: [replacedById] });
    }

    if (row.deprecatedAt !== null) {
      throw new MissingReferencesError({
        [kind]: [replacedById],
        reason: 'O substituto já está obsoleto.',
      });
    }
  }

  /** `RegisterNote.skillId` é único: outra nota já usa esta skill? */
  private async assertSkillFree(
    skillId: string | null | undefined,
    noteId: string,
  ): Promise<void> {
    if (skillId == null) {
      return;
    }

    const taken = await this.prisma.registerNote.findFirst({
      where: { skillId, id: { not: noteId } },
      select: { id: true },
    });

    if (taken !== null) {
      throw new RegisterSkillTakenError(skillId, taken.id);
    }
  }

  /** O asset de áudio de uma nota existe e é mesmo áudio. */
  private async assertAudioAsset(
    assetId: string | null | undefined,
  ): Promise<void> {
    if (assetId == null) {
      return;
    }

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: { kind: true },
    });

    if (asset?.kind !== 'AUDIO') {
      throw new MissingReferencesError({
        assets: [assetId],
        reason: 'O arquivo de áudio da nota não existe ou não é um áudio.',
      });
    }
  }

  /**
   * Troca o `audioAsset` cru pela URL assinada, que nasce na resposta
   * (nunca é guardada). `audioAssetId` continua na linha.
   */
  private async withAudio<
    T extends {
      audioAsset: {
        id: string;
        kind: MediaKind;
        storageKey: string;
        mimeType: string;
        durationMs: number | null;
      } | null;
    },
  >(rows: readonly T[]) {
    const resolved = await this.assets.resolveMap(
      rows.flatMap((row) => (row.audioAsset === null ? [] : [row.audioAsset])),
    );

    return rows.map(({ audioAsset, ...row }) => ({
      ...row,
      audio:
        audioAsset === null
          ? null
          : {
              url: resolved[audioAsset.id]?.url ?? '',
              mimeType: audioAsset.mimeType,
              durationMs: audioAsset.durationMs,
            },
    }));
  }

  // -------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------

  private flattenSkill<
    T extends {
      prerequisites: { prerequisiteId: string }[];
      commonErrors: { errorPatternId: string }[];
    },
  >(skill: T) {
    const { prerequisites, commonErrors, ...rest } = skill;

    return {
      ...rest,
      prerequisites: prerequisites.map((link) => link.prerequisiteId),
      commonErrors: commonErrors.map((link) => link.errorPatternId),
    };
  }

  private async syncSkillLinks(
    tx: Prisma.TransactionClient,
    skillId: string,
    input: Partial<SkillInput>,
  ): Promise<void> {
    if (input.prerequisites !== undefined) {
      await tx.skillPrerequisite.deleteMany({ where: { skillId } });

      if (input.prerequisites.length > 0) {
        await tx.skillPrerequisite.createMany({
          data: input.prerequisites.map((prerequisiteId) => ({
            skillId,
            prerequisiteId,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (input.commonErrors !== undefined) {
      await tx.skillErrorPattern.deleteMany({ where: { skillId } });

      if (input.commonErrors.length > 0) {
        await tx.skillErrorPattern.createMany({
          data: input.commonErrors.map((errorPatternId) => ({
            skillId,
            errorPatternId,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  private async linkErrorPatternSkills(
    tx: Prisma.TransactionClient,
    errorPatternId: string,
    skillIds: readonly string[],
  ): Promise<void> {
    if (skillIds.length === 0) {
      return;
    }

    await tx.skillErrorPattern.createMany({
      data: skillIds.map((skillId) => ({ skillId, errorPatternId })),
      skipDuplicates: true,
    });
  }
}
