import { randomInt, randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import {
  GenerationKind,
  GenerationStatus,
  MaterialKind,
  Prisma,
  type CefrLevel,
  type GenerationJob,
} from '@prisma/client';

import { EnvService } from 'src/common/config/env.service';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { generatorExercisesPrompt } from 'src/modules/ai/prompts/generator-exercises.prompt';
import { generatorFactCheckPrompt } from 'src/modules/ai/prompts/generator-fact-check.prompt';
import { generatorIngestAnalysisPrompt } from 'src/modules/ai/prompts/generator-ingest-analysis.prompt';
import {
  generatorMaterialPrompt,
  type GeneratorMaterialOutput,
} from 'src/modules/ai/prompts/generator-material.prompt';
import { generatorRewriteSentencesPrompt } from 'src/modules/ai/prompts/generator-rewrite-sentences.prompt';
import { generatorTopicSuggestPrompt } from 'src/modules/ai/prompts/generator-topic-suggest.prompt';
import { AiService } from 'src/modules/ai/services/ai.service';
import { AiCreditService } from 'src/modules/billing/services/ai-credit.service';
import { checkLevel } from 'src/modules/content-studio/domain/level-check';
import { ItemService } from 'src/modules/curriculum/services/item.service';
import { TaxonomyService } from 'src/modules/curriculum/services/taxonomy.service';
import { LearnerInterestService } from 'src/modules/learner-model/services/learner-interest.service';
import { LearnerProfileService } from 'src/modules/learner-model/services/learner-profile.service';
import { StudyTermService } from 'src/modules/srs/services/study-term.service';

import { levelBias, materialLevel } from '../domain/calibration';
import {
  quoteInSource,
  removeSentences,
  replaceSentence,
  splitSentences,
  claimMatchesSentence,
  unsupportedSentences,
  type Claim,
} from '../domain/claims';
import {
  exerciseMixIssues,
  MAX_EXERCISES,
  MIN_EXERCISES,
  validateExercise,
  type ValidExercise,
} from '../domain/exercises';
import {
  estimateLevel,
  longestVerbatimRun,
  looksEnglish,
  MAX_VERBATIM_WORDS,
  overCopiedSentences,
} from '../domain/ingest';
import {
  countWords,
  LEVEL_PROFILES,
  levelsUpTo,
  shiftLevel,
  wordCountIssue,
} from '../domain/level-profile';
import {
  MAX_TERM_CARDS,
  resolveMaterialSpans,
  sanitizeSupporting,
  type AllowedRefs,
  type MaterialContent,
} from '../domain/material';
import {
  failRunning,
  isDone,
  markStep,
  type GenerationStep,
  type StepState,
} from '../domain/steps';
import {
  materialCacheKey,
  pickTargets,
  THEME_TOPIC_PT,
  themeSkills,
  type ThemeCategory,
} from '../domain/targets';
import {
  LevelOutOfRangeError,
  NotEnoughExercisesError,
} from '../generator.errors';
import type {
  ChosenTopic,
  StoredSuggestions,
  Suggestion,
} from './generation-request.service';
import { IngestSources } from './ingest-sources';
import { SourceService } from './source.service';

/** Skill de leitura das questões de compreensão (seed do curriculum). */
export const COMPREHENSION_SKILL_ID = 'reading.short-texts';

type Analysis = {
  language: string;
  genre: 'NEWS' | 'LYRICS' | 'OTHER';
  topic: string;
  title: string;
  originalLevel: CefrLevel;
  referenceUrl: string | null;
};

type TargetsState = {
  level: CefrLevel;
  learnerLevel: CefrLevel;
  levelSource: string;
  bias: -1 | 0 | 1;
  skillIds: string[];
  registerNoteIds: string[];
  weakSkillIds: string[];
  weakErrorPatternIds: string[];
  topic: string;
};

type Validation = {
  claims: number;
  unsupported: number;
  rewritten: number;
  removedSentences: number;
  levelRatio: number;
  coverage: number;
  words: number;
  attempts: number;
};

type StepOutcome = { refused: string } | void;

/** Um pedido de material não pode chegar sem os dados das etapas de antes. */
class PipelineStateError extends Error {}

/**
 * O pipeline de um pedido ao generator, etapa por etapa.
 *
 * Cada etapa grava o seu resultado na linha do `GenerationJob` antes da
 * próxima começar; o retry do BullMQ retoma da primeira etapa que não
 * terminou, sem refazer chamada de IA já paga. O app acompanha pelo
 * `steps` da linha.
 */
@Injectable()
export class GenerationPipelineService {
  private readonly logger = new Logger(GenerationPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly ai: AiService,
    private readonly credits: AiCreditService,
    private readonly profiles: LearnerProfileService,
    private readonly interests: LearnerInterestService,
    private readonly taxonomy: TaxonomyService,
    private readonly items: ItemService,
    private readonly terms: StudyTermService,
    private readonly sources: SourceService,
    private readonly ingestSources: IngestSources,
    private readonly events: EventBusService,
  ) {}

  async run(jobId: string): Promise<{ status: string }> {
    let job = await this.prisma.generationJob.findUnique({
      where: { id: jobId },
    });

    if (
      job === null ||
      (job.status !== GenerationStatus.QUEUED &&
        job.status !== GenerationStatus.RUNNING)
    ) {
      return { status: 'SKIPPED' };
    }

    job = await this.update(job, { status: GenerationStatus.RUNNING });

    for (const state of steps(job)) {
      if (isDone(steps(job), state.step)) {
        continue;
      }

      job = await this.update(job, {
        steps: markStep(steps(job), state.step, 'RUNNING', new Date()),
        currentStep: state.step,
      });

      const outcome = await this.runStep(state.step, job);

      if (outcome !== undefined) {
        await this.finish(job, GenerationStatus.REFUSED, outcome.refused);
        return { status: GenerationStatus.REFUSED };
      }

      job = await this.reload(job.id);
      job = await this.update(job, {
        steps: markStep(steps(job), state.step, 'DONE', new Date()),
      });
    }

    await this.finish(job, GenerationStatus.DONE, null);
    return { status: GenerationStatus.DONE };
  }

  /** Última tentativa falhou (ou o erro não melhora tentando): estorna. */
  async fail(jobId: string, errorCode: string): Promise<void> {
    const job = await this.prisma.generationJob.findUnique({
      where: { id: jobId },
    });

    if (
      job === null ||
      job.status === GenerationStatus.DONE ||
      job.status === GenerationStatus.REFUSED ||
      job.status === GenerationStatus.FAILED
    ) {
      return;
    }

    await this.finish(job, GenerationStatus.FAILED, errorCode);
  }

  // -------------------------------------------------------------------------
  // Etapas
  // -------------------------------------------------------------------------

  private async runStep(
    step: GenerationStep,
    job: GenerationJob,
  ): Promise<StepOutcome> {
    switch (step) {
      case 'SUGGEST':
        return this.suggest(job);
      case 'FETCH_SOURCE':
        return this.fetchSource(job);
      case 'INGEST_SOURCE':
        return this.ingestSource(job);
      case 'ANALYZE':
        return this.analyze(job);
      case 'PICK_TARGETS':
        return this.pickTargets(job);
      case 'GENERATE':
        return this.generate(job);
      case 'VALIDATE':
        return this.validate(job);
      case 'EXERCISES':
        return this.exercises(job);
      case 'DELIVER':
        return this.deliver(job);
    }
  }

  /** Três assuntos concretos a partir do interesse (ou dos interesses do modelo). */
  private async suggest(job: GenerationJob): Promise<StepOutcome> {
    const snapshot = await this.profiles.getSnapshot(job.userId);
    const recent = await this.recentTitles(job.userId);

    const { data } = await this.ai.run(
      generatorTopicSuggestPrompt,
      {
        interestText: job.interestText,
        level: snapshot.overallLevel.level,
        interests: snapshot.interests.map((interest) => interest.topic),
        avoidTopics: [...snapshot.recentTopics, ...recent],
      },
      { userId: job.userId },
    );

    if (data.safety === 'INAPPROPRIATE') {
      return { refused: 'INAPPROPRIATE' };
    }

    const stored: StoredSuggestions = {
      themes: data.themes,
      items: data.suggestions.map((suggestion): Suggestion => ({
        id: randomUUID(),
        ...suggestion,
      })),
    };

    if (stored.items.length === 0) {
      throw new Error('A IA não sugeriu nenhum assunto.');
    }

    // "Surpreenda-me": o próprio pedido de material escolhe uma das três.
    const pick =
      job.kind === GenerationKind.TOPIC
        ? stored.items[randomInt(stored.items.length)]
        : undefined;

    await this.update(job, {
      suggestions: stored,
      ...(pick === undefined
        ? {}
        : {
            chosen: {
              title: pick.title,
              searchQuery: pick.wikipediaSearchQuery,
              category: pick.category,
              topic: stored.themes[0] ?? THEME_TOPIC_PT[pick.category],
            } satisfies ChosenTopic,
          }),
    });
  }

  private async fetchSource(job: GenerationJob): Promise<StepOutcome> {
    const chosen = required(job.chosen as ChosenTopic | null, 'chosen');
    const document = await this.sources.find(chosen.searchQuery);
    await this.update(job, { sourceDocumentId: document.id });
  }

  private async ingestSource(job: GenerationJob): Promise<StepOutcome> {
    const loaded = await this.ingestSources.load({
      text: job.inputText,
      url: job.inputUrl,
    });

    await this.update(job, {
      inputText: loaded.text,
      analysis: {
        referenceUrl: loaded.referenceUrl,
        sourceTitle: loaded.title,
      },
    });
  }

  private async analyze(job: GenerationJob): Promise<StepOutcome> {
    const text = required(job.inputText, 'inputText');
    const previous = (job.analysis ?? {}) as {
      referenceUrl?: string | null;
      sourceTitle?: string | null;
    };

    const { data } = await this.ai.run(
      generatorIngestAnalysisPrompt,
      { text },
      { userId: job.userId },
    );

    if (data.safety === 'INAPPROPRIATE') {
      return { refused: 'INAPPROPRIATE' };
    }

    // Dois sinais precisam concordar para recusar: a IA e a contagem de
    // palavras gramaticais do inglês. Um só pode errar num texto curto.
    if (data.language.toLowerCase() !== 'en' && !looksEnglish(text)) {
      return { refused: 'CONTENT_NOT_ENGLISH' };
    }

    const analysis: Analysis = {
      language: data.language,
      genre: data.genre,
      topic: data.topic,
      title: previous.sourceTitle ?? data.title,
      originalLevel: estimateLevel(
        text,
        this.env.get('CONTENT_QA_MAX_OUT_OF_LEVEL'),
      ),
      referenceUrl: previous.referenceUrl ?? job.inputUrl,
    };

    await this.update(job, { analysis });
  }

  /** Alvos sem IA, a partir do snapshot e da calibração pelo feedback. */
  private async pickTargets(job: GenerationJob): Promise<StepOutcome> {
    const snapshot = await this.profiles.getSnapshot(job.userId);
    const recentFeedback = await this.prisma.generatedMaterial.findMany({
      where: { userId: job.userId, difficulty: { not: null } },
      orderBy: { feedbackAt: 'desc' },
      take: 5,
      select: { difficulty: true },
    });
    const bias = levelBias(recentFeedback.map((row) => row.difficulty));
    const learnerLevel = snapshot.overallLevel.level;
    const level = materialLevel(learnerLevel, bias);

    const [catalog, notes] = await Promise.all([
      this.taxonomy.activeSkillsUpTo(levelsUpTo(shiftLevel(level, 1))),
      this.taxonomy.activeRegisterNotesAt(levelsUpTo(level)),
    ]);

    let category: ThemeCategory | null = null;
    let topic: string;
    let seed: string;

    if (job.kind === GenerationKind.TOPIC) {
      const chosen = required(job.chosen as ChosenTopic | null, 'chosen');
      const source = await this.sources.findById(
        required(job.sourceDocumentId, 'sourceDocumentId'),
      );
      category = chosen.category;
      topic = chosen.topic;
      seed = String(source.pageId);
    } else {
      const analysis = required(job.analysis as Analysis | null, 'analysis');
      topic = analysis.topic;
      seed = job.id;
    }

    const analysis = job.analysis as Analysis | null;
    const themeSkillIds =
      category !== null
        ? themeSkills(category)
        : analysis?.genre === 'NEWS'
          ? themeSkills('HISTORY')
          : [];

    const targets = pickTargets({
      level,
      weakSkillIds: snapshot.weaknesses.skills.map((skill) => skill.skillId),
      nextTargetSkillIds: snapshot.nextTargetSkills.map(
        (skill) => skill.skillId,
      ),
      themeSkillIds,
      catalog,
      registerNotes: notes,
      seed,
    });

    const state: TargetsState = {
      level,
      learnerLevel,
      levelSource: snapshot.overallLevel.source,
      bias,
      skillIds: targets.skillIds,
      registerNoteIds: targets.registerNoteIds,
      weakSkillIds: snapshot.weaknesses.skills
        .map((skill) => skill.skillId)
        .filter((id) => targets.skillIds.includes(id)),
      weakErrorPatternIds: snapshot.weaknesses.errorPatterns.map(
        (error) => error.id,
      ),
      topic,
    };

    await this.update(job, { targets: state });
  }

  /**
   * Texto do material. No tema, o material base de outro aluno com a mesma
   * fonte, nível e alvos é reaproveitado — sem chamar a IA, e a validação
   * (já feita naquele) é pulada.
   */
  private async generate(job: GenerationJob): Promise<StepOutcome> {
    const targets = required(job.targets as TargetsState | null, 'targets');

    if (job.kind === GenerationKind.TOPIC) {
      const source = await this.sources.findById(
        required(job.sourceDocumentId, 'sourceDocumentId'),
      );
      const cacheKey = materialCacheKey({
        pageId: source.pageId,
        revisionId: source.revisionId.toString(),
        level: targets.level,
        targetSkillIds: targets.skillIds,
        registerNoteIds: targets.registerNoteIds,
        promptVersion: generatorMaterialPrompt.version,
      });
      const base = await this.prisma.materialBase.findUnique({
        where: { cacheKey },
        select: { id: true },
      });

      if (base !== null) {
        await this.update(job, {
          baseId: base.id,
          steps: markStep(steps(job), 'VALIDATE', 'DONE', new Date()),
        });
        return;
      }
    }

    const output = await this.writeMaterial(job, targets, null);

    if (output.safety === 'INAPPROPRIATE') {
      return { refused: 'INAPPROPRIATE' };
    }

    await this.update(job, { draft: { output, attempts: 1 } });
  }

  /** Fatos, nível e cópia literal. Uma regeneração se o nível estourar. */
  private async validate(job: GenerationJob): Promise<StepOutcome> {
    const targets = required(job.targets as TargetsState | null, 'targets');
    const draft = required(
      job.draft as { output: GeneratorMaterialOutput; attempts: number } | null,
      'draft',
    );
    const source = await this.sourceText(job);
    const analysis = job.analysis as Analysis | null;
    const profile = LEVEL_PROFILES[targets.level];
    const maxRatio = this.env.get('CONTENT_QA_MAX_OUT_OF_LEVEL');

    let output = draft.output;
    let attempts = draft.attempts;

    for (;;) {
      const checked = await this.checkFacts(
        job.userId,
        output,
        source,
        targets.level,
      );
      let text = checked.text;
      let removedCopies = 0;

      if (analysis?.genre === 'LYRICS') {
        const copies = overCopiedSentences(splitSentences(text), source);
        removedCopies = copies.length;
        text = removeSentences(text, copies);
      }

      const level = checkLevel(text, targets.level);
      const words = countWords(text);
      const sizeIssue = wordCountIssue(words, profile, {
        enforceMinimum: job.kind === GenerationKind.TOPIC,
      });
      const levelOk = level.ratio <= maxRatio && sizeIssue === null;

      if (levelOk) {
        const content = this.buildContent(
          output,
          text,
          checked.claims,
          targets,
          analysis,
        );
        const validation: Validation = {
          claims: output.claims.length,
          unsupported: checked.unsupported,
          rewritten: checked.rewritten,
          removedSentences: checked.removed + removedCopies,
          levelRatio: Math.round(level.ratio * 1000) / 1000,
          coverage: Math.round(level.coverage * 1000) / 1000,
          words,
          attempts,
        };

        await this.saveValidated(job, content, validation);
        return;
      }

      if (attempts >= 2) {
        throw new LevelOutOfRangeError({
          ratio: level.ratio,
          words,
          sizeIssue,
          outOfLevel: level.outOfLevel.slice(0, 20),
        });
      }

      const notes = [
        level.ratio > maxRatio
          ? `Too many words above ${targets.level}: ${level.outOfLevel
              .map((entry) => entry.word)
              .join(', ')}. Replace them with simpler words.`
          : '',
        sizeIssue === 'TOO_LONG'
          ? `The text has ${String(words)} words; keep it under ${String(profile.maxWords)}.`
          : '',
        sizeIssue === 'TOO_SHORT'
          ? `The text has ${String(words)} words; write at least ${String(profile.minWords)}.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      output = await this.writeMaterial(job, targets, notes);
      attempts += 1;

      if (output.safety === 'INAPPROPRIATE') {
        return { refused: 'INAPPROPRIATE' };
      }

      await this.update(job, { draft: { output, attempts } });
    }
  }

  /** Os exercícios **deste** aluno, sobre o texto (base ou próprio). */
  private async exercises(job: GenerationJob): Promise<StepOutcome> {
    const targets = required(job.targets as TargetsState | null, 'targets');
    const content = await this.content(job);
    const analysis = job.analysis as Analysis | null;
    const [skills, notes, errorCatalog, comprehension] = await Promise.all([
      this.targetSkills(targets),
      this.taxonomy.registerNotesByIds(targets.registerNoteIds),
      this.taxonomy.activeErrorPatterns(),
      this.taxonomy.existingSkillIds([COMPREHENSION_SKILL_ID]),
    ]);
    const comprehensionSkillId = comprehension[0] ?? null;
    const weakFirst = [
      ...errorCatalog.filter((error) =>
        targets.weakErrorPatternIds.includes(error.id),
      ),
      ...errorCatalog.filter(
        (error) => !targets.weakErrorPatternIds.includes(error.id),
      ),
    ];

    const refs = {
      skillIds: new Set([
        ...targets.skillIds,
        ...(comprehensionSkillId === null ? [] : [comprehensionSkillId]),
      ]),
      errorPatternIds: new Set(errorCatalog.map((error) => error.id)),
      registerNoteIds: new Set(targets.registerNoteIds),
    };
    const source =
      analysis?.genre === 'LYRICS' ? await this.sourceText(job) : null;

    let revisionNotes: string | null = null;
    let valid: ValidExercise[] = [];

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { data } = await this.ai.run(
        generatorExercisesPrompt,
        {
          level: content.level,
          text: content.text,
          targetSkills: skills.map((skill) => ({
            id: skill.id,
            title: skill.title,
          })),
          comprehensionSkillId,
          registerNotes: notes.map((note) => ({
            id: note.id,
            spokenForm: note.spokenForm,
            standardForm: note.standardForm,
          })),
          vocabulary: content.vocabulary.map((entry) => ({
            term: entry.term,
            meaningPtBr: entry.meaningPtBr,
          })),
          errorPatterns: weakFirst.slice(0, 20),
          learnerErrorIds: targets.weakErrorPatternIds,
          count: { min: MIN_EXERCISES + 2, max: MAX_EXERCISES },
          revisionNotes,
        },
        { userId: job.userId },
      );

      const rejected: string[] = [];
      valid = [];

      for (const draft of data.exercises) {
        const verdict = validateExercise(draft, refs);

        if (!verdict.ok) {
          rejected.push(`${draft.type}: ${verdict.reason}`);
          continue;
        }

        // Letra de música: exercício não pode citar trecho longo dela.
        if (
          source !== null &&
          longestVerbatimRun(exerciseText(verdict.exercise), source) >
            MAX_VERBATIM_WORDS
        ) {
          rejected.push(`${draft.type}: cita trecho longo da letra`);
          continue;
        }

        valid.push(verdict.exercise);
      }

      valid = valid.slice(0, MAX_EXERCISES);
      const issues = exerciseMixIssues(valid, new Set(targets.skillIds));

      if (issues.length === 0) {
        await this.update(job, { exercises: valid });
        return;
      }

      this.logger.warn(
        { jobId: job.id, issues, rejected: rejected.length },
        'Exercícios gerados insuficientes',
      );
      revisionNotes = [...issues, ...rejected.slice(0, 10)].join('\n');
    }

    throw new NotEnoughExercisesError(
      exerciseMixIssues(valid, new Set(targets.skillIds)),
    );
  }

  /**
   * Entrega: exercícios viram itens privados, o material é gravado e o
   * vocabulário vira termo do aluno (card no SRS pelo evento).
   */
  private async deliver(job: GenerationJob): Promise<StepOutcome> {
    if (job.materialId !== null) {
      return;
    }

    const targets = required(job.targets as TargetsState | null, 'targets');
    const exercises = required(
      job.exercises as ValidExercise[] | null,
      'exercises',
    );
    const content = await this.content(job);
    const analysis = job.analysis as Analysis | null;
    const source =
      job.sourceDocumentId === null
        ? null
        : await this.sources.findById(job.sourceDocumentId);

    const termIds = await this.terms.upsertMany(
      job.userId,
      'GENERATED_MATERIAL',
      content.vocabulary.slice(0, MAX_TERM_CARDS).map((entry) => ({
        term: entry.term,
        meaning: entry.meaningPtBr,
        example: entry.example,
        cefrLevel: entry.cefr,
      })),
    );

    const snapshotUsed = {
      learnerLevel: targets.learnerLevel,
      levelSource: targets.levelSource,
      levelBias: targets.bias,
      materialLevel: targets.level,
      targetSkillIds: targets.skillIds,
      weakSkillIds: targets.weakSkillIds,
      weakErrorPatternIds: targets.weakErrorPatternIds,
      ...(analysis === null
        ? {}
        : { originalLevel: analysis.originalLevel, genre: analysis.genre }),
    };

    const material = await this.prisma.$transaction(async (tx) => {
      const itemIds = await this.items.createGeneratedItems(
        exercises.map((exercise) => ({
          type: exercise.type,
          prompt: exercise.prompt,
          content: exercise.content,
          acceptedAnswers: exercise.acceptedAnswers,
          explanation: exercise.explanation,
          errorPatternMap: exercise.errorPatternMap,
          cefrLevel: targets.level,
          skillIds: exercise.skillIds,
        })),
        tx,
      );

      const created = await tx.generatedMaterial.create({
        data: {
          userId: job.userId,
          kind:
            job.kind === GenerationKind.TOPIC
              ? MaterialKind.TOPIC
              : MaterialKind.INGEST,
          baseId: job.baseId,
          ...(job.kind === GenerationKind.INGEST
            ? { content: content as unknown as Prisma.InputJsonValue }
            : {}),
          title: content.title,
          level: targets.level,
          topic: targets.topic,
          targetSkillIds: targets.skillIds,
          registerNoteIds: targets.registerNoteIds,
          snapshotUsed,
          ...(source === null
            ? {}
            : {
                attribution: {
                  title: source.title,
                  url: source.url,
                  revisionId: source.revisionId.toString(),
                  license: source.license,
                  licenseUrl: source.licenseUrl,
                  provider: 'Wikipedia',
                },
              }),
          referenceUrl: analysis?.referenceUrl ?? null,
          itemIds,
          termIds,
        },
      });

      await tx.generationJob.update({
        where: { id: job.id },
        data: { materialId: created.id },
      });

      return created;
    });

    this.events.emit(
      'generator.material_delivered',
      {
        materialId: material.id,
        kind: material.kind,
        level: material.level,
        targetSkillIds: material.targetSkillIds,
        termIds: material.termIds,
        topic: material.topic,
      },
      { userId: job.userId },
    );

    try {
      await this.interests.applySignal(
        job.userId,
        material.topic,
        'MATERIAL_GENERATED',
      );
    } catch (error) {
      // Sinal de interesse é bônus: não derruba um material já entregue.
      this.logger.warn(
        { err: error, jobId: job.id },
        'Sinal de interesse falhou',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Peças
  // -------------------------------------------------------------------------

  private async writeMaterial(
    job: GenerationJob,
    targets: TargetsState,
    revisionNotes: string | null,
  ): Promise<GeneratorMaterialOutput> {
    const [skills, notes] = await Promise.all([
      this.targetSkills(targets),
      this.taxonomy.registerNotesByIds(targets.registerNoteIds),
    ]);
    const analysis = job.analysis as Analysis | null;
    const sourceTitle =
      job.kind === GenerationKind.TOPIC
        ? (
            await this.sources.findById(
              required(job.sourceDocumentId, 'sourceDocumentId'),
            )
          ).title
        : (analysis?.title ?? 'Your text');

    const { data } = await this.ai.run(
      generatorMaterialPrompt,
      {
        mode: job.kind === GenerationKind.TOPIC ? 'TOPIC' : 'INGEST',
        level: targets.level,
        profile: LEVEL_PROFILES[targets.level],
        maxOutOfLevelPct: Math.round(
          this.env.get('CONTENT_QA_MAX_OUT_OF_LEVEL') * 100,
        ),
        targetSkills: skills.map((skill) => ({
          id: skill.id,
          title: skill.title,
        })),
        registerNotes: notes.map((note) => ({
          id: note.id,
          spokenForm: note.spokenForm,
          standardForm: note.standardForm,
        })),
        genre: analysis?.genre ?? null,
        sourceTitle,
        source: await this.sourceText(job),
        revisionNotes,
      },
      { userId: job.userId },
    );

    return data;
  }

  /**
   * Checagem de fatos: citação literal (sem IA) → confirmação da IA → uma
   * reescrita das frases reprovadas → o que ainda não se sustenta sai.
   */
  private async checkFacts(
    userId: string,
    output: GeneratorMaterialOutput,
    source: string,
    level: CefrLevel,
  ): Promise<{
    text: string;
    claims: Claim[];
    unsupported: number;
    rewritten: number;
    removed: number;
  }> {
    const supported = await this.supportedClaims(userId, output.claims, source);
    const bad = unsupportedSentences(output.text, output.claims, supported);
    let text = output.text;
    const claims = output.claims.filter(
      (_, index) => supported[index] === true,
    );

    if (bad.length === 0) {
      return { text, claims, unsupported: 0, rewritten: 0, removed: 0 };
    }

    const { data } = await this.ai.run(
      generatorRewriteSentencesPrompt,
      {
        level,
        sentences: bad.map((sentence, index) => ({
          index,
          sentence: sentence.text,
        })),
        source,
      },
      { userId },
    );

    const candidates = data.rewrites.flatMap((rewrite) => {
      const original = bad[rewrite.index];
      return original !== undefined &&
        rewrite.sentence !== null &&
        rewrite.sourceQuote !== null
        ? [
            {
              original,
              claim: {
                sentence: rewrite.sentence,
                sourceQuote: rewrite.sourceQuote,
              },
            },
          ]
        : [];
    });
    const candidateSupport = await this.supportedClaims(
      userId,
      candidates.map((candidate) => candidate.claim),
      source,
    );
    const accepted = new Map(
      candidates
        .filter((_, index) => candidateSupport[index] === true)
        .map((candidate) => [candidate.original, candidate.claim]),
    );

    // Do fim para o começo: os índices das frases anteriores continuam valendo.
    const ordered = [...bad].sort((a, b) => b.start - a.start);
    let removed = 0;

    for (const sentence of ordered) {
      const replacement = accepted.get(sentence);

      if (replacement === undefined) {
        text = removeSentences(text, [sentence]);
        removed += 1;
      } else {
        text = replaceSentence(text, sentence, replacement.sentence);
        claims.push(replacement);
      }
    }

    return {
      text,
      claims,
      unsupported: bad.length,
      rewritten: accepted.size,
      removed,
    };
  }

  /** `true` por claim: citação literal na fonte **e** confirmada pela IA. */
  private async supportedClaims(
    userId: string,
    claims: readonly Claim[],
    source: string,
  ): Promise<boolean[]> {
    const literal = claims.map((claim) =>
      quoteInSource(claim.sourceQuote, source),
    );
    const toCheck = claims
      .map((claim, index) => ({ index, ...claim }))
      .filter(({ index }) => literal[index] === true);

    if (toCheck.length === 0) {
      return literal;
    }

    const { data } = await this.ai.run(
      generatorFactCheckPrompt,
      { claims: toCheck },
      { userId },
    );
    const verdicts = new Map(
      data.verdicts.map((verdict) => [verdict.index, verdict.supported]),
    );

    return claims.map(
      (_, index) => literal[index] === true && verdicts.get(index) === true,
    );
  }

  private buildContent(
    output: GeneratorMaterialOutput,
    text: string,
    claims: readonly Claim[],
    targets: TargetsState,
    analysis: Analysis | null,
  ): MaterialContent {
    const allowed: AllowedRefs = {
      skillIds: new Set(targets.skillIds),
      registerNoteIds: new Set(targets.registerNoteIds),
    };
    const sentences = splitSentences(text);
    const supporting = sanitizeSupporting(
      {
        text,
        grammarSpotlight: output.grammarSpotlight,
        registerNotes: output.registerNotes,
        vocabulary: output.vocabulary,
      },
      allowed,
    );

    return {
      title: output.title,
      level: targets.level,
      text,
      spans: resolveMaterialSpans(text, output.spans, allowed),
      // Letra de música: a citação é trecho da letra — não fica guardada.
      claims:
        analysis?.genre === 'LYRICS'
          ? []
          : claims.filter((claim) =>
              sentences.some((sentence) =>
                claimMatchesSentence(claim, sentence.text),
              ),
            ),
      grammarSpotlight: supporting.grammarSpotlight,
      spokenVersion: output.spokenVersion,
      registerNotes: supporting.registerNotes,
      vocabulary: supporting.vocabulary,
    };
  }

  private async saveValidated(
    job: GenerationJob,
    content: MaterialContent,
    validation: Validation,
  ): Promise<void> {
    if (job.kind !== GenerationKind.TOPIC) {
      await this.update(job, { draft: { content, validation } });
      return;
    }

    const targets = required(job.targets as TargetsState | null, 'targets');
    const source = await this.sources.findById(
      required(job.sourceDocumentId, 'sourceDocumentId'),
    );
    const cacheKey = materialCacheKey({
      pageId: source.pageId,
      revisionId: source.revisionId.toString(),
      level: targets.level,
      targetSkillIds: targets.skillIds,
      registerNoteIds: targets.registerNoteIds,
      promptVersion: generatorMaterialPrompt.version,
    });

    // Dois alunos gerando a mesma base ao mesmo tempo: fica a primeira.
    const base = await this.prisma.materialBase.upsert({
      where: { cacheKey },
      update: {},
      create: {
        cacheKey,
        sourceDocumentId: source.id,
        level: targets.level,
        targetSkillIds: targets.skillIds,
        registerNoteIds: targets.registerNoteIds,
        content: content as unknown as Prisma.InputJsonValue,
        validation: validation as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await this.update(job, { baseId: base.id });
  }

  /** O material validado: da base compartilhada (tema) ou do rascunho (ingest). */
  private async content(job: GenerationJob): Promise<MaterialContent> {
    if (job.baseId !== null) {
      const base = await this.prisma.materialBase.findUniqueOrThrow({
        where: { id: job.baseId },
        select: { content: true },
      });
      return base.content as unknown as MaterialContent;
    }

    const draft = job.draft as { content?: MaterialContent } | null;
    return required(draft?.content ?? null, 'draft.content');
  }

  private async sourceText(job: GenerationJob): Promise<string> {
    if (job.kind === GenerationKind.TOPIC) {
      const source = await this.sources.findById(
        required(job.sourceDocumentId, 'sourceDocumentId'),
      );
      return source.extract;
    }

    return required(job.inputText, 'inputText');
  }

  /** Skills-alvo na ordem da escolha: a mais importante primeiro. */
  private async targetSkills(
    targets: TargetsState,
  ): Promise<{ id: string; title: string }[]> {
    const skills = await this.taxonomy.skillsByIds(targets.skillIds);
    return [...skills].sort(
      (a, b) => targets.skillIds.indexOf(a.id) - targets.skillIds.indexOf(b.id),
    );
  }

  private async recentTitles(userId: string): Promise<string[]> {
    const rows = await this.prisma.generatedMaterial.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { title: true },
    });
    return rows.map((row) => row.title);
  }

  /**
   * Fecha o pedido. O texto colado pelo aluno é apagado aqui, com sucesso
   * ou não — só o material (e, na letra de música, trechos curtos) fica.
   */
  private async finish(
    job: GenerationJob,
    status: GenerationStatus,
    errorCode: string | null,
  ): Promise<void> {
    const finalSteps =
      status === GenerationStatus.DONE
        ? steps(job)
        : failRunning(steps(job), new Date());

    // Estorno antes do status final: quem vê o pedido encerrado (e a
    // mensagem "o crédito voltou") já encontra o saldo devolvido. O estorno
    // é idempotente, então repetir num retry não devolve duas vezes.
    if (status !== GenerationStatus.DONE && job.creditReservationId !== null) {
      await this.credits.refund(
        job.creditReservationId,
        status === GenerationStatus.REFUSED ? 'refused' : 'job_failed',
      );
    }

    await this.prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status,
        errorCode,
        steps: finalSteps as unknown as Prisma.InputJsonValue,
        currentStep: null,
        inputText: null,
        draft: Prisma.DbNull,
        exercises: Prisma.DbNull,
        completedAt: new Date(),
      },
    });
  }

  private async update(
    job: GenerationJob,
    data: {
      status?: GenerationStatus;
      steps?: StepState[];
      currentStep?: string | null;
      suggestions?: StoredSuggestions;
      chosen?: ChosenTopic;
      sourceDocumentId?: string;
      inputText?: string;
      analysis?: unknown;
      targets?: TargetsState;
      baseId?: string;
      draft?: unknown;
      exercises?: ValidExercise[];
    },
  ): Promise<GenerationJob> {
    const { steps: nextSteps, ...rest } = data;
    const json = (value: unknown) => value as Prisma.InputJsonValue;

    return this.prisma.generationJob.update({
      where: { id: job.id },
      data: {
        ...(rest.status === undefined ? {} : { status: rest.status }),
        ...(nextSteps === undefined ? {} : { steps: json(nextSteps) }),
        ...(rest.currentStep === undefined
          ? {}
          : { currentStep: rest.currentStep }),
        ...(rest.suggestions === undefined
          ? {}
          : { suggestions: json(rest.suggestions) }),
        ...(rest.chosen === undefined ? {} : { chosen: json(rest.chosen) }),
        ...(rest.sourceDocumentId === undefined
          ? {}
          : { sourceDocumentId: rest.sourceDocumentId }),
        ...(rest.inputText === undefined ? {} : { inputText: rest.inputText }),
        ...(rest.analysis === undefined
          ? {}
          : { analysis: json(rest.analysis) }),
        ...(rest.targets === undefined ? {} : { targets: json(rest.targets) }),
        ...(rest.baseId === undefined ? {} : { baseId: rest.baseId }),
        ...(rest.draft === undefined ? {} : { draft: json(rest.draft) }),
        ...(rest.exercises === undefined
          ? {}
          : { exercises: json(rest.exercises) }),
      },
    });
  }

  private async reload(id: string): Promise<GenerationJob> {
    return this.prisma.generationJob.findUniqueOrThrow({ where: { id } });
  }
}

function steps(job: GenerationJob): StepState[] {
  return job.steps as unknown as StepState[];
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new PipelineStateError(`Etapa anterior não gravou ${what}.`);
  }
  return value;
}

/** Todo texto de um exercício, para a checagem de cópia literal. */
function exerciseText(exercise: ValidExercise): string {
  return [
    exercise.prompt,
    JSON.stringify(exercise.content),
    ...exercise.acceptedAnswers,
  ].join(' ');
}
