import { Injectable, Logger } from '@nestjs/common';
import {
  ContentDraftStatus,
  type CefrLevel,
  type Prisma,
} from '@prisma/client';
import type { LessonStepInput } from '@english-saas/shared';

import { EnvService } from 'src/common/config/env.service';
import { NotFoundError } from 'src/common/errors/app.exception';
import { EventBusService } from 'src/infra/events/event-bus.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { reviewLanguagePrompt } from 'src/modules/ai/prompts/review-language.prompt';
import { AiService } from 'src/modules/ai/services/ai.service';

import {
  collectItemSegments,
  collectStepSegments,
  englishOf,
  type ContentSegment,
} from '../domain/content-text';
import { checkConsistency, type ConsistencyItem } from '../domain/consistency';
import {
  checkLevelOfMany,
  exceedsLevelBudget,
  hasUsefulCoverage,
  type LevelCheckResult,
} from '../domain/level-check';
import {
  sortWarnings,
  summarize,
  warn,
  type QaWarning,
} from '../domain/qa-report';

export const QA_RUN_JOB = 'qa-run';

export type QaJobData = {
  draftId?: string;
  lessonVersionId?: string;
  itemIds?: string[];
  level: CefrLevel;
  /** Avisos que o mapeamento do rascunho já produziu. */
  mappingWarnings?: QaWarning[];
};

/**
 * Verificações automáticas antes da revisão humana.
 *
 * Três camadas: nível (quanto vocabulário está acima do alvo), consistência
 * (a lição ensina e mede o que promete, e as questões fecham) e revisão
 * linguística por IA.
 *
 * **Nada aqui altera conteúdo.** O resultado é uma lista de avisos. A única
 * consequência automática é o `BLOCKER`, que impede a aprovação — e mesmo
 * essa é uma trava, não uma edição.
 */
@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly events: EventBusService,
    private readonly envService: EnvService,
  ) {}

  async run(data: QaJobData): Promise<void> {
    const warnings: QaWarning[] = [...(data.mappingWarnings ?? [])];
    let levelStats: LevelCheckResult | null = null;

    if (data.lessonVersionId !== undefined) {
      const result = await this.checkLessonVersion(
        data.lessonVersionId,
        data.level,
      );

      warnings.push(...result.warnings);
      levelStats = result.levelStats;
    } else if (data.itemIds !== undefined && data.itemIds.length > 0) {
      const result = await this.checkItems(data.itemIds, data.level);

      warnings.push(...result.warnings);
      levelStats = result.levelStats;
    }

    const sorted = sortWarnings(warnings);
    const counts = summarize(sorted);

    await this.prisma.contentQaReport.create({
      data: {
        ...(data.lessonVersionId === undefined
          ? {}
          : { lessonVersionId: data.lessonVersionId }),
        ...(data.draftId === undefined ? {} : { contentDraftId: data.draftId }),
        warnings: sorted as unknown as Prisma.InputJsonValue,
        levelStats: (levelStats ?? {}) as unknown as Prisma.InputJsonValue,
        blockerCount: counts.blockerCount,
        warningCount: counts.warningCount,
        infoCount: counts.infoCount,
      },
    });

    if (data.draftId !== undefined) {
      const draft = await this.prisma.contentDraft.update({
        where: { id: data.draftId },
        data: { status: ContentDraftStatus.READY },
        select: { id: true, kind: true, createdItemIds: true },
      });

      this.events.emit('content.draft_ready', {
        draftId: draft.id,
        kind: draft.kind,
        lessonVersionId: data.lessonVersionId ?? null,
        createdItemCount: draft.createdItemIds.length,
        blockerCount: counts.blockerCount,
        warningCount: counts.warningCount,
      });
    }

    this.logger.log(
      {
        lessonVersionId: data.lessonVersionId,
        draftId: data.draftId,
        ...counts,
      },
      'QA concluída',
    );
  }

  /** Roda a QA numa versão sob demanda, fora do fluxo de rascunho. */
  async runForVersion(lessonVersionId: string): Promise<void> {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lessonVersionId },
      select: { cefrLevel: true },
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    await this.run({ lessonVersionId, level: version.cefrLevel });
  }

  async latestFor(lessonVersionId: string) {
    const report = await this.prisma.contentQaReport.findFirst({
      where: { lessonVersionId },
      orderBy: { ranAt: 'desc' },
    });

    if (report === null) {
      throw new NotFoundError('A QA ainda não rodou nesta versão.');
    }

    return report;
  }

  /** Último relatório, ou `null`. Usado pela trava de aprovação. */
  async latestOrNull(lessonVersionId: string) {
    return this.prisma.contentQaReport.findFirst({
      where: { lessonVersionId },
      orderBy: { ranAt: 'desc' },
    });
  }

  // -------------------------------------------------------------------

  private async checkLessonVersion(
    lessonVersionId: string,
    level: CefrLevel,
  ): Promise<{ warnings: QaWarning[]; levelStats: LevelCheckResult }> {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lessonVersionId },
      select: {
        steps: {
          orderBy: { order: 'asc' },
          select: { type: true, content: true },
        },
        targetSkills: {
          orderBy: { position: 'asc' },
          select: { skillId: true },
        },
      },
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    const steps = version.steps as unknown as LessonStepInput[];
    const itemIds = steps.flatMap((step) =>
      step.type === 'PRACTICE' ? step.content.itemIds : [],
    );

    const items = await this.loadItems(itemIds);
    const segments = [
      ...collectStepSegments(steps),
      ...collectItemSegments(items),
    ];

    const levelStats = checkLevelOfMany(englishOf(segments), level);

    const warnings: QaWarning[] = [
      ...this.levelWarnings(levelStats, level),
      ...checkConsistency({
        targetSkillIds: version.targetSkills.map((target) => target.skillId),
        steps,
        items: items as ConsistencyItem[],
      }),
      ...(await this.languageWarnings(segments)),
    ];

    return { warnings, levelStats };
  }

  private async checkItems(
    itemIds: string[],
    level: CefrLevel,
  ): Promise<{ warnings: QaWarning[]; levelStats: LevelCheckResult }> {
    const items = await this.loadItems(itemIds);
    const segments = collectItemSegments(items);
    const levelStats = checkLevelOfMany(englishOf(segments), level);

    const warnings: QaWarning[] = [
      ...this.levelWarnings(levelStats, level),
      ...checkConsistency({
        targetSkillIds: [],
        steps: [],
        items: items as ConsistencyItem[],
      }),
      ...(await this.languageWarnings(segments)),
    ];

    return { warnings, levelStats };
  }

  private async loadItems(itemIds: readonly string[]) {
    if (itemIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.item.findMany({
      where: { id: { in: [...itemIds] } },
      select: {
        id: true,
        type: true,
        prompt: true,
        content: true,
        acceptedAnswers: true,
        explanation: true,
        skills: { orderBy: { position: 'asc' }, select: { skillId: true } },
      },
    });

    // Ordem do JSON da prática, não a do banco: o caminho do aviso precisa
    // bater com o que o editor vê na tela.
    const byId = new Map(rows.map((row) => [row.id, row]));

    return itemIds.flatMap((id) => {
      const row = byId.get(id);

      return row === undefined
        ? []
        : [
            {
              id: row.id,
              type: row.type,
              prompt: row.prompt,
              content: row.content,
              acceptedAnswers: row.acceptedAnswers,
              explanation: row.explanation,
              skillIds: row.skills.map((skill) => skill.skillId),
            },
          ];
    });
  }

  private levelWarnings(
    stats: LevelCheckResult,
    level: CefrLevel,
  ): QaWarning[] {
    const warnings: QaWarning[] = [];
    const max = this.envService.get('CONTENT_QA_MAX_OUT_OF_LEVEL');

    if (exceedsLevelBudget(stats, max)) {
      warnings.push(
        warn(
          'LEVEL_ABOVE_TARGET',
          `${(stats.ratio * 100).toFixed(1)}% das palavras estão acima de ${level} (teto: ${(max * 100).toFixed(0)}%). Fora do nível: ${stats.outOfLevel
            .map((entry) => `${entry.word} (${entry.band})`)
            .join(', ')}.`,
          'level',
        ),
      );
    }

    if (!hasUsefulCoverage(stats)) {
      warnings.push(
        warn(
          'LEVEL_LOW_COVERAGE',
          `A lista de frequência conhece só ${(stats.coverage * 100).toFixed(0)}% das palavras deste texto (${String(stats.wordlistSize)} palavras na lista). A checagem de nível está fraca até a lista definitiva entrar.`,
          'level',
        ),
      );
    }

    return warnings;
  }

  /**
   * Revisão linguística por IA.
   *
   * Falha aqui não derruba a QA: as outras checagens já valem, e um
   * rascunho sem revisão de língua é melhor que rascunho nenhum.
   */
  private async languageWarnings(
    segments: readonly ContentSegment[],
  ): Promise<QaWarning[]> {
    if (segments.length === 0) {
      return [];
    }

    try {
      const result = await this.ai.run(reviewLanguagePrompt, {
        segments: segments.map((segment) => ({
          path: segment.path,
          english: segment.english,
          portuguese: segment.portuguese,
        })),
      });

      return result.data.issues.map((issue) =>
        warn(
          issue.kind === 'ENGLISH' ? 'LANGUAGE_ISSUE' : 'TRANSLATION_ISSUE',
          issue.suggestion === null
            ? `${issue.message} (trecho: "${issue.excerpt}")`
            : `${issue.message} (trecho: "${issue.excerpt}" → sugestão: "${issue.suggestion}")`,
          issue.path,
        ),
      );
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'desconhecido' },
        'Revisão linguística falhou — seguindo sem ela',
      );

      return [];
    }
  }
}
