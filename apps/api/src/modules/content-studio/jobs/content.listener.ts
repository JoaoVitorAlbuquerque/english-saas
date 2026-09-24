import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { DomainEvent } from 'src/common/events';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUES } from 'src/infra/queue/queues';

import { ReviewService } from '../services/review.service';
import { TTS_GENERATE_JOB } from '../services/tts.service';
import { WORKBOOK_PDF_JOB } from '../services/workbook.service';

/**
 * O que acontece depois de aprovar e depois de publicar.
 *
 * **Aprovou** → as questões da lição são publicadas junto (a revisão humana
 * foi essa) e a narração entra na fila. O editor ouve o áudio antes de
 * mandar para o ar; sem áudio, o publish é recusado pelo gate.
 *
 * **Publicou** → a apostila da unidade é regerada, agora que o conteúdo
 * publicado mudou.
 */
@Injectable()
export class ContentListener {
  private readonly logger = new Logger(ContentListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly review: ReviewService,
    @InjectQueue(QUEUES.MEDIA) private readonly media: Queue,
  ) {}

  /**
   * Emitido com `emitAsync` pelo módulo 4: a promoção das questões precisa
   * estar gravada antes de alguém tentar publicar.
   */
  @OnEvent('curriculum.lesson_approved')
  async onLessonApproved(
    event: DomainEvent<'curriculum.lesson_approved'>,
  ): Promise<void> {
    const { lessonVersionId } = event.payload;

    const promoted = await this.review.promoteLessonItems(lessonVersionId);

    await this.media.add(TTS_GENERATE_JOB, { lessonVersionId });

    this.logger.log(
      { lessonVersionId, promoted },
      'Versão aprovada: questões publicadas e narração enfileirada',
    );
  }

  @OnEvent('curriculum.lesson_published')
  async onLessonPublished(
    event: DomainEvent<'curriculum.lesson_published'>,
  ): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: event.payload.lessonId },
      select: { unitId: true },
    });

    if (lesson === null) {
      return;
    }

    await this.media.add(WORKBOOK_PDF_JOB, { unitId: lesson.unitId });

    this.logger.log(
      { unitId: lesson.unitId },
      'Lição publicada: apostila enfileirada',
    );
  }
}
