import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  ContentDraftStatus,
  ItemSource,
  type CefrLevel,
  type Prisma,
} from '@prisma/client';
import type { LessonStepInput } from '@english-saas/shared';
import { Queue } from 'bullmq';

import { EnvService } from 'src/common/config/env.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';
import {
  draftItemsPrompt,
  type DraftItemsContext,
} from 'src/modules/ai/prompts/draft-items.prompt';
import {
  draftLessonPrompt,
  type DraftLessonContext,
  type DraftLessonOutput,
} from 'src/modules/ai/prompts/draft-lesson.prompt';
import { draftRegisterNotesPrompt } from 'src/modules/ai/prompts/draft-register-notes.prompt';
import { AiService } from 'src/modules/ai/services/ai.service';
import { LessonAuthoringService } from 'src/modules/curriculum/services/lesson-authoring.service';
import { ItemService } from 'src/modules/curriculum/services/item.service';

import { DraftRequestError } from '../content-studio.errors';
import {
  mapDraftItem,
  resolveSpans,
  type MarkedSpan,
} from '../domain/draft-mapping';
import type { QaWarning } from '../domain/qa-report';
import type {
  DraftItemsParams,
  DraftLessonParams,
  DraftRegisterNotesParams,
} from './draft.service';
import { QA_RUN_JOB } from './qa.service';

/**
 * Onde a IA vira conteúdo de verdade.
 *
 * Roda dentro do processor, nunca num request. A saída já sai validada pelo
 * schema do prompt (módulo 2) e passa pelos schemas do módulo 4 antes de
 * virar linha — se não passar, o job falha e o rascunho fica em FAILED.
 *
 * Tudo que nasce aqui nasce em DRAFT. Um humano ainda tem que aprovar.
 */
@Injectable()
export class DraftGeneratorService {
  private readonly logger = new Logger(DraftGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly lessons: LessonAuthoringService,
    private readonly items: ItemService,
    private readonly envService: EnvService,
    @InjectQueue(QUEUES.CONTENT_QA) private readonly qaQueue: Queue,
  ) {}

  private get maxOutOfLevelPct(): number {
    return Math.round(this.envService.get('CONTENT_QA_MAX_OUT_OF_LEVEL') * 100);
  }

  // -------------------------------------------------------------------
  // Lição
  // -------------------------------------------------------------------

  async generateLesson(draftId: string): Promise<void> {
    const draft = await this.start(draftId);
    const params = draft.params as unknown as DraftLessonParams;

    const [skills, characters, errorPatterns, registerNotes] =
      await Promise.all([
        this.prisma.skill.findMany({
          where: { id: { in: params.targetSkillIds } },
          select: { id: true, title: true, type: true, description: true },
        }),
        this.prisma.character.findMany({
          where: { id: { in: params.characterIds } },
          select: { id: true, slug: true, name: true, bio: true },
        }),
        this.prisma.errorPattern.findMany({
          where: { deprecatedAt: null },
          take: 30,
          select: { id: true, example: true, correction: true },
        }),
        this.prisma.registerNote.findMany({
          where: { deprecatedAt: null, cefrLevel: params.level },
          take: 20,
          select: { id: true, spokenForm: true, standardForm: true },
        }),
      ]);

    if (skills.length === 0) {
      throw new DraftRequestError(
        'O pedido precisa de ao menos uma skill-alvo que exista.',
      );
    }

    if (characters.length === 0) {
      throw new DraftRequestError(
        'O pedido precisa de ao menos um personagem que exista.',
      );
    }

    const versionId = await this.resolveLessonVersion(params);

    const context: DraftLessonContext = {
      level: params.level,
      objective: params.objective,
      unitContext: params.unitContext ?? 'Primeira lição da unidade.',
      targetSkills: skills,
      characters: characters.map(({ slug, name, bio }) => ({
        slug,
        name,
        bio,
      })),
      errorPatterns,
      registerNotes,
      maxOutOfLevelPct: this.maxOutOfLevelPct,
    };

    const result = await this.ai.run(draftLessonPrompt, context);

    const characterIdBySlug = Object.fromEntries(
      characters.map((character) => [character.slug, character.id]),
    );

    const { steps, itemIds, warnings } = await this.materializeLesson(
      result.data,
      { characterIdBySlug, level: params.level },
    );

    await this.lessons.updateVersion(versionId, {
      title: result.data.title,
      objective: result.data.objective,
      cefrLevel: params.level,
      estimatedMinutes: result.data.estimatedMinutes,
      targetSkillIds: params.targetSkillIds,
    });

    await this.lessons.replaceSteps(
      versionId,
      steps.map((step, order) => ({
        order,
        type: step.type,
        content: step.content,
      })),
    );

    await this.prisma.contentDraft.update({
      where: { id: draftId },
      data: {
        status: ContentDraftStatus.QA_RUNNING,
        promptId: draftLessonPrompt.id,
        promptVersion: draftLessonPrompt.version,
        model: result.usage.model,
        costUsdMicros: result.usage.costUsdMicros,
        lessonVersionId: versionId,
        createdItemIds: itemIds,
        generatedAt: new Date(),
      },
    });

    await this.qaQueue.add(QA_RUN_JOB, {
      draftId,
      lessonVersionId: versionId,
      level: params.level,
      mappingWarnings: warnings,
    });
  }

  /**
   * Acha (ou cria) a versão em DRAFT que vai receber o conteúdo.
   *
   * Aceita os dois caminhos: uma lição que já existe — e aí abre a próxima
   * versão se a atual estiver publicada — ou uma lição nova na unidade.
   */
  private async resolveLessonVersion(
    params: DraftLessonParams,
  ): Promise<string> {
    if (params.lessonId !== undefined) {
      const lesson = await this.lessons.findLesson(params.lessonId);
      const open = lesson.versions.find(
        (version) =>
          version.status === 'DRAFT' ||
          version.status === 'IN_REVIEW' ||
          version.status === 'APPROVED',
      );

      if (open !== undefined) {
        return open.id;
      }

      const created = await this.lessons.createDraftVersion(params.lessonId);

      return created.id;
    }

    if (
      params.unitId === undefined ||
      params.slug === undefined ||
      params.order === undefined
    ) {
      throw new DraftRequestError(
        'Informe uma lição existente, ou a unidade, o slug e a posição da lição nova.',
      );
    }

    const lesson = await this.lessons.createLesson({
      unitId: params.unitId,
      slug: params.slug,
      order: params.order,
      title: params.title ?? params.objective.slice(0, 120),
      objective: params.objective,
      cefrLevel: params.level,
      targetSkillIds: params.targetSkillIds,
    });

    const version = lesson.versions[0];

    if (version === undefined) {
      throw new DraftRequestError('A lição nasceu sem versão — isso é um bug.');
    }

    return version.id;
  }

  /**
   * Saída da IA → etapas e questões gravadas.
   *
   * As questões entram primeiro, porque a etapa de prática referencia os
   * ids delas.
   */
  private async materializeLesson(
    output: DraftLessonOutput,
    context: { characterIdBySlug: Record<string, string>; level: CefrLevel },
  ): Promise<{
    steps: LessonStepInput[];
    itemIds: string[];
    warnings: QaWarning[];
  }> {
    const warnings: QaWarning[] = [];
    const itemIds: string[] = [];

    for (const draftItem of output.practice) {
      const mapped = mapDraftItem(draftItem);

      const created = await this.items.create({
        type: mapped.type as never,
        prompt: mapped.prompt,
        content: mapped.content,
        acceptedAnswers: mapped.acceptedAnswers,
        explanation: mapped.explanation,
        errorPatternMap: mapped.errorPatternMap,
        cefrLevel: context.level,
        skillIds: mapped.skillIds,
        source: ItemSource.AI_DRAFT,
      });

      itemIds.push(created.id);
    }

    const characterId = (slug: string): string => {
      const id = context.characterIdBySlug[slug];

      if (id === undefined) {
        throw new DraftRequestError(
          `A IA usou o personagem "${slug}", que não estava no pedido.`,
        );
      }

      return id;
    };

    const sceneLines = output.scene.lines.map((line, index) => {
      const resolved = resolveSpans(
        line.text,
        line.spans as MarkedSpan[],
        `scene.lines.${String(index)}`,
      );

      warnings.push(...resolved.warnings);

      return {
        characterId: characterId(line.characterSlug),
        text: line.text,
        ...(line.standardText === null || line.standardText === line.text
          ? {}
          : { standardText: line.standardText }),
        translation: line.translation,
        spans: resolved.spans,
      };
    });

    const cards = output.cards.map((card, cardIndex) => ({
      title: card.title,
      bodyMd: card.bodyMd,
      ...(card.table === null ? {} : { table: card.table }),
      examples: card.examples.map((example, exampleIndex) => {
        const resolved = resolveSpans(
          example.text,
          example.spans as MarkedSpan[],
          `cards.${String(cardIndex)}.examples.${String(exampleIndex)}`,
        );

        warnings.push(...resolved.warnings);

        return {
          text: example.text,
          ...(example.translation === null
            ? {}
            : { translation: example.translation }),
          spans: resolved.spans,
        };
      }),
    }));

    const steps = [
      {
        type: 'SCENE' as const,
        content: {
          location: output.scene.location,
          ...(output.scene.summary === null
            ? {}
            : { summary: output.scene.summary }),
          characterIds: [
            ...new Set(sceneLines.map((line) => line.characterId)),
          ],
          lines: sceneLines,
        },
      },
      { type: 'EXPLANATION_CARDS' as const, content: { cards } },
      { type: 'PRACTICE' as const, content: { itemIds, shuffle: false } },
      {
        type: 'FREE_PRODUCTION' as const,
        content: {
          prompt: output.freeProduction.prompt,
          helpers: output.freeProduction.helpers,
          rubric: output.freeProduction.rubric.map((criterion) => ({
            id: criterion.id,
            description: criterion.description,
            ...(criterion.skillId === null
              ? {}
              : { skillId: criterion.skillId }),
            ...(criterion.errorPatternId === null
              ? {}
              : { errorPatternId: criterion.errorPatternId }),
          })),
          targetSkillIds: [],
          ...(output.freeProduction.minWords === null
            ? {}
            : { minWords: output.freeProduction.minWords }),
        },
      },
      {
        type: 'ROLEPLAY' as const,
        content: {
          characterId: characterId(output.roleplay.characterSlug),
          scenario: output.roleplay.scenario,
          ...(output.roleplay.openingLine === null
            ? {}
            : { openingLine: output.roleplay.openingLine }),
          goals: output.roleplay.goals,
          maxTurns: output.roleplay.maxTurns,
          allowedVocabularyLevel: context.level,
        },
      },
      {
        type: 'SUMMARY' as const,
        content: {
          takeaways: output.summary.takeaways,
          skillIds: [],
          registerNoteIds: [],
        },
      },
    ] as unknown as LessonStepInput[];

    return { steps, itemIds, warnings };
  }

  // -------------------------------------------------------------------
  // Questões avulsas
  // -------------------------------------------------------------------

  async generateItems(draftId: string): Promise<void> {
    const draft = await this.start(draftId);
    const params = draft.params as unknown as DraftItemsParams;

    const skill = await this.prisma.skill.findUnique({
      where: { id: params.skillId },
      select: { id: true, title: true, type: true, description: true },
    });

    if (skill === null) {
      throw new DraftRequestError(`A skill "${params.skillId}" não existe.`);
    }

    const [errorPatterns, registerNotes] = await Promise.all([
      this.prisma.errorPattern.findMany({
        where: { deprecatedAt: null },
        take: 30,
        select: { id: true, example: true, correction: true },
      }),
      this.prisma.registerNote.findMany({
        where: { deprecatedAt: null },
        take: 20,
        select: { id: true, spokenForm: true, standardForm: true },
      }),
    ]);

    const context: DraftItemsContext = {
      level: params.level,
      skill,
      count: params.count,
      types: params.types as DraftItemsContext['types'],
      errorPatterns,
      registerNotes,
      maxOutOfLevelPct: this.maxOutOfLevelPct,
    };

    const result = await this.ai.run(draftItemsPrompt, context);
    const itemIds: string[] = [];

    for (const draftItem of result.data.items) {
      const mapped = mapDraftItem(draftItem);

      const created = await this.items.create({
        type: mapped.type as never,
        prompt: mapped.prompt,
        content: mapped.content,
        acceptedAnswers: mapped.acceptedAnswers,
        explanation: mapped.explanation,
        errorPatternMap: mapped.errorPatternMap,
        cefrLevel: params.level,
        skillIds: mapped.skillIds.includes(skill.id)
          ? mapped.skillIds
          : [skill.id, ...mapped.skillIds],
        source: ItemSource.AI_DRAFT,
      });

      itemIds.push(created.id);
    }

    await this.prisma.contentDraft.update({
      where: { id: draftId },
      data: {
        status: ContentDraftStatus.QA_RUNNING,
        promptId: draftItemsPrompt.id,
        promptVersion: draftItemsPrompt.version,
        model: result.usage.model,
        costUsdMicros: result.usage.costUsdMicros,
        createdItemIds: itemIds,
        generatedAt: new Date(),
      },
    });

    await this.qaQueue.add(QA_RUN_JOB, {
      draftId,
      itemIds,
      level: params.level,
    });
  }

  // -------------------------------------------------------------------
  // Notas de registro
  // -------------------------------------------------------------------

  async generateRegisterNotes(draftId: string): Promise<void> {
    const draft = await this.start(draftId);
    const params = draft.params as unknown as DraftRegisterNotesParams;

    const existing = await this.prisma.registerNote.findMany({
      select: { id: true },
      take: 100,
    });

    const result = await this.ai.run(draftRegisterNotesPrompt, {
      level: params.level,
      count: params.count,
      existingIds: existing.map((note) => note.id),
    });

    const taken = new Set(existing.map((note) => note.id));
    const createdIds: string[] = [];

    for (const note of result.data.notes) {
      if (taken.has(note.id)) {
        continue;
      }

      await this.prisma.registerNote.create({
        data: {
          id: note.id,
          spokenForm: note.spokenForm,
          standardForm: note.standardForm,
          register: note.register,
          explanation: note.explanation,
          whenToAvoid: note.whenToAvoid,
          cefrLevel: note.cefrLevel,
        },
      });

      taken.add(note.id);
      createdIds.push(note.id);
    }

    await this.prisma.contentDraft.update({
      where: { id: draftId },
      data: {
        status: ContentDraftStatus.READY,
        promptId: draftRegisterNotesPrompt.id,
        promptVersion: draftRegisterNotesPrompt.version,
        model: result.usage.model,
        costUsdMicros: result.usage.costUsdMicros,
        createdRegisterNoteIds: createdIds,
        generatedAt: new Date(),
      },
    });

    this.logger.log(
      { draftId, count: createdIds.length },
      'Notas de registro geradas',
    );
  }

  // -------------------------------------------------------------------

  private async start(draftId: string) {
    return this.prisma.contentDraft.update({
      where: { id: draftId },
      data: { status: ContentDraftStatus.GENERATING },
      select: { id: true, kind: true, params: true },
    });
  }

  /** Marca o rascunho como falho. Chamado pelo processor. */
  async fail(draftId: string, errorCode: string): Promise<void> {
    await this.prisma.contentDraft.update({
      where: { id: draftId },
      data: {
        status: ContentDraftStatus.FAILED,
        errorCode: errorCode.slice(0, 120),
      },
    });
  }

  /** Só para o processor não precisar conhecer o Prisma. */
  async kindOf(draftId: string): Promise<string> {
    const draft = await this.prisma.contentDraft.findUniqueOrThrow({
      where: { id: draftId },
      select: { kind: true },
    });

    return draft.kind;
  }

  /** Params tipados como JSON do Prisma. */
  static asParams<T>(value: Prisma.JsonValue): T {
    return value as unknown as T;
  }
}
