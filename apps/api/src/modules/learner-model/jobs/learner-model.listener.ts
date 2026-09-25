import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

import type { DomainEvent } from 'src/common/events';
import { QUEUES } from 'src/infra/queue/queues';

import { LearnerProfileService } from '../services/learner-profile.service';
import {
  LEARNER_UPDATE_JOB,
  PLACEMENT_PRIOR_JOB,
  REVIEW_OUTCOME_JOB,
} from '../services/learner-update.service';

/**
 * O que acorda o modelo do aluno.
 *
 * `answer.submitted` e `placement.completed`. O `tutor.feedback` (12) entra
 * aqui quando o tutor existir.
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

  /**
   * Nivelamento concluído vira ponto de partida. Vai para a mesma fila das
   * respostas, sob a mesma trava por aluno: as respostas do próprio
   * nivelamento estão sendo processadas ao mesmo tempo.
   */
  @OnEvent('placement.completed')
  async onPlacementCompleted(
    event: DomainEvent<'placement.completed'>,
  ): Promise<void> {
    const { userId, payload } = event;

    if (userId === undefined) {
      return;
    }

    await this.queue.add(
      PLACEMENT_PRIOR_JOB,
      {
        userId,
        placementId: payload.placementId,
        theta: payload.theta,
        competencyThetas: Object.fromEntries(
          Object.entries(payload.levelsByCompetency).map(
            ([competency, entry]) => [competency, entry.theta],
          ),
        ),
        completedAt: payload.completedAt,
      },
      { jobId: `placement-${payload.placementId}` },
    );
  }

  /**
   * SKILL já chega pelo `answer.submitted` de sempre — só VOCAB, CHUNK e
   * ERROR_PATTERN entram aqui (ver `LearnerUpdateService.applyReviewOutcome`).
   */
  @OnEvent('review.answered')
  async onReviewAnswered(event: DomainEvent<'review.answered'>): Promise<void> {
    const { userId, payload } = event;

    if (
      userId === undefined ||
      (payload.kind !== 'VOCAB' &&
        payload.kind !== 'CHUNK' &&
        payload.kind !== 'ERROR_PATTERN')
    ) {
      return;
    }

    await this.queue.add(
      REVIEW_OUTCOME_JOB,
      {
        userId,
        kind: payload.kind,
        refId: payload.refId,
        rating: payload.rating,
        at: payload.answeredAt,
      },
      { jobId: `review-${payload.cardId}-${payload.answeredAt}` },
    );
  }
}
