import { Injectable } from '@nestjs/common';
import type {
  CefrLevel,
  Competency,
  Prisma,
  RegisterLevel,
  SkillType,
} from '@prisma/client';
import type { Paginated } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';

import {
  MissingReferencesError,
  SlugInUseError,
  TaxonomySlugIsImmutableError,
} from '../curriculum.errors';

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
  deprecatedAt: true,
  replacedById: true,
  createdAt: true,
  updatedAt: true,
  prerequisites: { select: { prerequisiteId: true } },
  commonErrors: { select: { errorPatternId: true } },
} satisfies Prisma.SkillSelect;

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // Skill
  // -------------------------------------------------------------------

  async listSkills(query: {
    cursor?: string | undefined;
    limit: number;
    includeDeprecated?: boolean | undefined;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.skill.findMany({
      take,
      ...cursorArgs,
      where: query.includeDeprecated === true ? {} : { deprecatedAt: null },
      orderBy: { id: 'asc' },
      select: skillSelect,
    });

    const page = buildPage(rows, query.limit, (row) => row.id);

    return { ...page, data: page.data.map((row) => this.flattenSkill(row)) };
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

    await this.findSkill(id);
    await this.assertSkillsExist(input.prerequisites ?? []);
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

  async listErrorPatterns(query: {
    cursor?: string | undefined;
    limit: number;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.errorPattern.findMany({
      take,
      ...cursorArgs,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        description: true,
        example: true,
        correction: true,
        explanation: true,
        deprecatedAt: true,
        replacedById: true,
        skills: { select: { skillId: true } },
      },
    });

    const page = buildPage(rows, query.limit, (row) => row.id);

    return {
      ...page,
      data: page.data.map(({ skills, ...row }) => ({
        ...row,
        skillIds: skills.map((link) => link.skillId),
      })),
    };
  }

  async findErrorPattern(id: string) {
    const pattern = await this.prisma.errorPattern.findUnique({
      where: { id },
      select: {
        id: true,
        description: true,
        example: true,
        correction: true,
        explanation: true,
        deprecatedAt: true,
        replacedById: true,
        skills: { select: { skillId: true } },
      },
    });

    if (pattern === null) {
      throw new NotFoundError('Não encontramos este padrão de erro.');
    }

    const { skills, ...rest } = pattern;

    return { ...rest, skillIds: skills.map((link) => link.skillId) };
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

  async listRegisterNotes(query: {
    cursor?: string | undefined;
    limit: number;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.registerNote.findMany({
      take,
      ...cursorArgs,
      orderBy: { id: 'asc' },
    });

    return buildPage(rows, query.limit, (row) => row.id);
  }

  async findRegisterNote(id: string) {
    const note = await this.prisma.registerNote.findUnique({ where: { id } });

    if (note === null) {
      throw new NotFoundError('Não encontramos esta nota de registro.');
    }

    return note;
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

    return this.prisma.registerNote.create({
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
  }

  async updateRegisterNote(id: string, input: Partial<RegisterNoteInput>) {
    if (input.id !== undefined && input.id !== id) {
      throw new TaxonomySlugIsImmutableError(id);
    }

    await this.findRegisterNote(id);

    if (input.skillId !== undefined) {
      await this.assertRegisterSkill(input.skillId);
    }

    return this.prisma.registerNote.update({
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
