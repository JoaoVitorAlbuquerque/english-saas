import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import {
  LESSON_COMPLETED_JOB,
  WRONG_ANSWER_JOB,
} from '../services/srs-update.service';

/**
 * O que acorda o SRS: `lesson.completed` cria os cards da lição, e
 * `answer.submitted` errado de primeira tentativa registra o lapse — acerto
 * não mexe em nada aqui, só a revisão de verdade (`POST /reviews/:id/answer`)
 * agenda o próximo `due` de um card existente.
 */
@Injectable()
export class SrsListener {
  constructor(@InjectQueue(QUEUES.SCHEDULING) private readonly queue: Queue) {}

  @OnEvent('lesson.completed')
  async onLessonCompleted(
    event: DomainEvent<'lesson.completed'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined) {
      return;
    }

    await this.queue.add(
      LESSON_COMPLETED_JOB,
      { userId, lessonVersionId: payload.lessonVersionId },
      { jobId: `lesson-${payload.attemptId}` },
    );
  }

  @OnEvent('answer.submitted')
  async onAnswerSubmitted(
    event: DomainEvent<'answer.submitted'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined || !payload.isFirstTry || payload.isCorrect) {
      return;
    }

    await this.queue.add(
      WRONG_ANSWER_JOB,
      {
        userId,
        primarySkillId: payload.skillIds[0],
        errorPatternIds: payload.errorPatterns,
      },
      { jobId: `wrong-${payload.answerId}` },
    );
  }
}
