import { Injectable } from '@nestjs/common';
import {
  CommentTarget,
  ContentStatus,
  ItemSource,
  type AudioIssueKind,
} from '@prisma/client';
import type { LessonStepInput } from '@english-saas/shared';

import { NotFoundError } from 'src/common/errors/app.exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';

/**
 * Revisão humana: comentários por etapa e por item.
 *
 * "Pedir alterações" e "aprovar" não moram aqui — são o `reject` e o
 * `approve` do módulo 4, que já gravam quem aprovou e quando. Duplicar isso
 * daria dois lugares para o mesmo estado.
 */
@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(lessonVersionId: string, includeResolved = false) {
    return this.prisma.contentComment.findMany({
      where: {
        lessonVersionId,
        ...(includeResolved ? {} : { resolvedAt: null }),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        target: true,
        targetRef: true,
        body: true,
        audioIssue: true,
        resolvedAt: true,
        resolvedById: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
  }

  /** Problemas de áudio ainda abertos, por chave de áudio. */
  async openAudioIssues(lessonVersionId: string) {
    const rows = await this.prisma.contentComment.findMany({
      where: {
        lessonVersionId,
        target: CommentTarget.AUDIO,
        resolvedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        targetRef: true,
        audioIssue: true,
        body: true,
        createdAt: true,
      },
    });

    const byKey = new Map<string, typeof rows>();

    for (const row of rows) {
      if (row.targetRef === null) {
        continue;
      }

      byKey.set(row.targetRef, [...(byKey.get(row.targetRef) ?? []), row]);
    }

    return byKey;
  }

  async comment(
    lessonVersionId: string,
    authorId: string,
    input: {
      target: CommentTarget;
      targetRef?: string | null;
      audioIssue?: AudioIssueKind | undefined;
      body: string;
    },
  ) {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lessonVersionId },
      select: { id: true },
    });

    if (version === null) {
      throw new NotFoundError('Não encontramos esta versão da lição.');
    }

    return this.prisma.contentComment.create({
      data: {
        lessonVersionId,
        authorId,
        target: input.target,
        targetRef: input.targetRef ?? null,
        audioIssue: input.audioIssue ?? null,
        body: input.body,
      },
      select: {
        id: true,
        target: true,
        targetRef: true,
        body: true,
        audioIssue: true,
        createdAt: true,
      },
    });
  }

  async resolve(commentId: string, userId: string) {
    const comment = await this.prisma.contentComment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (comment === null) {
      throw new NotFoundError('Não encontramos este comentário.');
    }

    return this.prisma.contentComment.update({
      where: { id: commentId },
      data: { resolvedAt: new Date(), resolvedById: userId },
      select: { id: true, resolvedAt: true, resolvedById: true },
    });
  }

  /**
   * Publica as questões da prática junto com a lição aprovada.
   *
   * Aprovar a lição **é** a revisão humana das questões dela — quem revisou
   * a lição leu os itens. Pedir uma aprovação separada por item seria
   * clique sem ganho de segurança. O que muda é o `source`: o que era
   * `AI_DRAFT` passa a `AI_DRAFT_REVIEWED`, que é justamente "saiu de IA e
   * um humano olhou".
   */
  async promoteLessonItems(lessonVersionId: string): Promise<number> {
    const version = await this.prisma.lessonVersion.findUnique({
      where: { id: lessonVersionId },
      select: {
        steps: {
          orderBy: { order: 'asc' },
          select: { type: true, content: true },
        },
      },
    });

    if (version === null) {
      return 0;
    }

    const steps = version.steps as unknown as LessonStepInput[];
    const itemIds = steps.flatMap((step) =>
      step.type === 'PRACTICE' ? step.content.itemIds : [],
    );

    if (itemIds.length === 0) {
      return 0;
    }

    const pending = await this.prisma.item.findMany({
      where: {
        id: { in: itemIds },
        status: { notIn: [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED] },
      },
      select: { id: true, source: true },
    });

    if (pending.length === 0) {
      return 0;
    }

    await this.prisma.$transaction([
      this.prisma.item.updateMany({
        where: { id: { in: pending.map((item) => item.id) } },
        data: { status: ContentStatus.PUBLISHED },
      }),
      this.prisma.item.updateMany({
        where: {
          id: {
            in: pending
              .filter((item) => item.source === ItemSource.AI_DRAFT)
              .map((item) => item.id),
          },
        },
        data: { source: ItemSource.AI_DRAFT_REVIEWED },
      }),
    ]);

    return pending.length;
  }
}
