import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  ContentDraftKind,
  ContentDraftStatus,
  ContentStatus,
  type CefrLevel,
  type Prisma,
} from '@prisma/client';
import type { Paginated } from '@english-saas/shared';
import { Queue } from 'bullmq';

import { NotFoundError } from 'src/common/errors/app.exception';
import { buildPage, toPrismaCursorArgs } from 'src/common/pagination/cursor';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';

import { estimateDraftCost } from '../domain/draft-cost';

export const DRAFT_LESSON_JOB = 'draft-lesson';
export const DRAFT_ITEMS_JOB = 'draft-items';
export const DRAFT_REGISTER_NOTES_JOB = 'draft-register-notes';

export type DraftLessonParams = {
  /** Lição existente. Quando ausente, a lição é criada na unidade. */
  lessonId?: string;
  unitId?: string;
  slug?: string;
  order?: number;
  title?: string;
  objective: string;
  level: CefrLevel;
  targetSkillIds: string[];
  characterIds: string[];
  /** Contexto da unidade que vai no prompt. */
  unitContext?: string;
};

export type DraftItemsParams = {
  skillId: string;
  level: CefrLevel;
  count: number;
  types: string[];
};

export type DraftRegisterNotesParams = {
  level: CefrLevel;
  count: number;
};

function paramsCount(params: Prisma.JsonValue): number | null {
  if (params !== null && typeof params === 'object' && !Array.isArray(params)) {
    const count = params['count'];

    return typeof count === 'number' ? count : null;
  }

  return null;
}

const draftSelect = {
  id: true,
  kind: true,
  status: true,
  params: true,
  promptId: true,
  promptVersion: true,
  model: true,
  costUsdMicros: true,
  lessonVersionId: true,
  createdItemIds: true,
  createdRegisterNoteIds: true,
  errorCode: true,
  generatedAt: true,
  discardedAt: true,
  createdAt: true,
  requestedBy: { select: { id: true, name: true } },
  qaReports: {
    orderBy: { ranAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      warnings: true,
      levelStats: true,
      blockerCount: true,
      warningCount: true,
      infoCount: true,
      ranAt: true,
    },
  },
} satisfies Prisma.ContentDraftSelect;

/**
 * Pedidos de rascunho.
 *
 * O controller só enfileira e devolve o id — gerar uma lição inteira leva
 * dezenas de segundos, muito além dos ~2s que um request pode segurar (ver
 * CLAUDE.md). Quem faz o trabalho é o `DraftGeneratorService`, dentro do
 * processor.
 */
@Injectable()
export class DraftService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.CONTENT_DRAFTS) private readonly queue: Queue,
  ) {}

  async requestLesson(userId: string, params: DraftLessonParams) {
    return this.enqueue(
      userId,
      ContentDraftKind.LESSON,
      DRAFT_LESSON_JOB,
      params,
    );
  }

  async requestItems(userId: string, params: DraftItemsParams) {
    return this.enqueue(
      userId,
      ContentDraftKind.ITEMS,
      DRAFT_ITEMS_JOB,
      params,
    );
  }

  async requestRegisterNotes(userId: string, params: DraftRegisterNotesParams) {
    return this.enqueue(
      userId,
      ContentDraftKind.REGISTER_NOTES,
      DRAFT_REGISTER_NOTES_JOB,
      params,
    );
  }

  async list(query: {
    cursor?: string | undefined;
    limit: number;
    status?: ContentDraftStatus | undefined;
    kind?: ContentDraftKind | undefined;
  }): Promise<Paginated<unknown>> {
    const { take, ...cursorArgs } = toPrismaCursorArgs(query);

    const rows = await this.prisma.contentDraft.findMany({
      take,
      ...cursorArgs,
      where: {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.kind === undefined ? {} : { kind: query.kind }),
      },
      // Do mais novo para o mais antigo; o id desempata e mantém o cursor estável.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: draftSelect,
    });

    return buildPage(rows, query.limit, (row) => row.id);
  }

  /**
   * Quanto um pedido deve custar, pela média dos últimos rascunhos prontos do
   * mesmo tipo. Sem histórico (ou com provedor fake, que cobra 0), `null`.
   */
  async estimate(kind: ContentDraftKind, count: number) {
    const recent = await this.prisma.contentDraft.findMany({
      where: { kind, status: ContentDraftStatus.READY },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { kind: true, costUsdMicros: true, params: true },
    });

    return estimateDraftCost(
      recent.map((draft) => ({
        kind: draft.kind,
        costUsdMicros: draft.costUsdMicros,
        count: paramsCount(draft.params),
      })),
      kind,
      count,
    );
  }

  async findById(id: string) {
    const draft = await this.prisma.contentDraft.findUnique({
      where: { id },
      select: draftSelect,
    });

    if (draft === null) {
      throw new NotFoundError('Não encontramos este rascunho.');
    }

    return draft;
  }

  /**
   * Descarta o rascunho e arquiva o que ele criou.
   *
   * Arquiva em vez de apagar: o que a IA produziu é registro de custo e de
   * qualidade do prompt, e some do caminho do editor do mesmo jeito.
   */
  async discard(id: string) {
    const draft = await this.findById(id);

    await this.prisma.$transaction(async (tx) => {
      if (draft.createdItemIds.length > 0) {
        await tx.item.updateMany({
          where: {
            id: { in: draft.createdItemIds },
            status: { not: ContentStatus.PUBLISHED },
          },
          data: { status: ContentStatus.ARCHIVED },
        });
      }

      if (draft.lessonVersionId !== null) {
        await tx.lessonVersion.updateMany({
          where: {
            id: draft.lessonVersionId,
            status: { in: [ContentStatus.DRAFT, ContentStatus.IN_REVIEW] },
          },
          data: { status: ContentStatus.ARCHIVED },
        });
      }

      await tx.contentDraft.update({
        where: { id },
        data: {
          status: ContentDraftStatus.DISCARDED,
          discardedAt: new Date(),
        },
      });
    });

    return this.findById(id);
  }

  private async enqueue(
    userId: string,
    kind: ContentDraftKind,
    jobName: string,
    params: object,
  ) {
    const draft = await this.prisma.contentDraft.create({
      data: {
        kind,
        requestedById: userId,
        params: params as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    const job = await this.queue.add(jobName, { draftId: draft.id });

    await this.prisma.contentDraft.update({
      where: { id: draft.id },
      data: { jobId: job.id ?? null },
    });

    return this.findById(draft.id);
  }
}
