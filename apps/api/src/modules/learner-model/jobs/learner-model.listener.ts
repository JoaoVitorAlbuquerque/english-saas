import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { LearnerProfileService } from '../services/learner-profile.service';
import { LEARNER_UPDATE_JOB } from '../services/learner-update.service';

/**
 * O que acorda o modelo do aluno.
 *
 * Hoje só `answer.submitted`. O `tutor.feedback` (12) e o
 * `placement.completed` (8) entram aqui quando esses módulos existirem.
 *
 * Um job por resposta, com o id da resposta: o mesmo evento entregue duas
 * vezes não enfileira duas vezes.
 */
@Injectable()
export class LearnerModelListener {
  constructor(
    @InjectQueue(QUEUES.LEARNER_UPDATES) private readonly queue: Queue,
    private readonly profiles: LearnerProfileService,
  ) {}

  @OnEvent('answer.submitted')
  async onAnswerSubmitted(
    event: DomainEvent<'answer.submitted'>,
  ): Promise<void> {
    const { userId } = event;

    if (userId === undefined) {
      return;
    }

    // Apaga já: o snapshot antigo não deve sobreviver a uma resposta nova,
    // nem durante os segundos até o job rodar.
    await this.profiles.invalidate(userId);

    await this.queue.add(
      LEARNER_UPDATE_JOB,
      { userId },
      { jobId: `answer-${event.payload.answerId}` },
    );
  }
}
