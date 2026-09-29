import { Injectable } from '@nestjs/common';
import type { ReviewCard } from '@prisma/client';

import { EventBusService } from 'src/infra/events/event-bus.service';
import {
  AnswerService,
  type AnswerResult,
} from 'src/modules/learning/services/answer.service';

import type { FsrsRating } from '../domain/fsrs';
import { ratingFromAnswer } from '../domain/rating';
import type { ReviewAnswerDto } from '../dto/srs.dto';
import { ReviewCardKindMismatchError } from '../srs.errors';
import { ReviewCardService } from './review-card.service';

export type ReviewAnswerResult = {
  cardId: string;
  rating: FsrsRating;
  /** Quando o card volta a vencer, depois do FSRS reagendar. */
  nextDueAt: Date;
  state: ReviewCard['state'];
  /**
   * Só em card de SKILL: a correção completa da questão (gabarito,
   * explicação, erros típicos), pro cliente mostrar o mesmo feedback que
   * `POST /answers` daria — sem precisar chamar as duas rotas.
   */
  answer?: AnswerResult;
};

type Rated = { rating: FsrsRating; answer?: AnswerResult };

/**
 * Responde um card. SKILL passa pelo `AnswerService.record` do learning
 * (contexto REVIEW) — a correção e o `answer.submitted` de sempre cuidam do
 * resto, e o resultado completo volta pro cliente junto do reagendamento.
 * Os demais são auto-avaliados: o rating é o que o aluno mandou.
 */
@Injectable()
export class ReviewAnswerService {
  constructor(
    private readonly cards: ReviewCardService,
    private readonly answers: AnswerService,
    private readonly events: EventBusService,
  ) {}

  async answer(
    userId: string,
    cardId: string,
    body: ReviewAnswerDto,
    now = new Date(),
  ): Promise<ReviewAnswerResult> {
    const card = await this.cards.findOwned(userId, cardId);
    const { rating, answer } = await this.rate(userId, card, body);
    const updated = await this.cards.applyRating(card, rating, now);

    this.events.emit(
      'review.answered',
      {
        cardId: updated.id,
        kind: updated.kind,
        refId: updated.refId,
        rating,
        due: updated.due.toISOString(),
        stability: updated.stability,
        reps: updated.reps,
        lapses: updated.lapses,
        state: updated.state,
        answeredAt: now.toISOString(),
      },
      { userId },
    );

    return {
      cardId: updated.id,
      rating,
      nextDueAt: updated.due,
      state: updated.state,
      ...(answer === undefined ? {} : { answer }),
    };
  }

  private async rate(
    userId: string,
    card: ReviewCard,
    body: ReviewAnswerDto,
  ): Promise<Rated> {
    if (card.kind === 'SKILL') {
      if (
        body.kind !== 'ITEM' ||
        body.itemId === undefined ||
        body.response === undefined ||
        body.responseTimeMs === undefined
      ) {
        throw new ReviewCardKindMismatchError(card.kind);
      }

      const result = await this.answers.record({
        userId,
        itemId: body.itemId,
        context: 'REVIEW',
        response: body.response,
        responseTimeMs: body.responseTimeMs,
        hintsUsed: body.hintsUsed,
        clientAnswerId: body.clientAnswerId,
      });

      const rating = ratingFromAnswer({
        isCorrect: result.isCorrect,
        hintsUsed: body.hintsUsed ?? 0,
        responseTimeMs: body.responseTimeMs,
        // Aproximação: `reps` sem lapse é o card indo bem — não é o mesmo
        // "correctStreak" da mastery (7), que não existe aqui no FSRS.
        correctStreak: card.lapses === 0 ? card.reps : 0,
      });

      return { rating, answer: result };
    }

    if (body.kind !== 'SELF_RATING' || body.selfRating === undefined) {
      throw new ReviewCardKindMismatchError(card.kind);
    }

    return { rating: body.selfRating };
  }
}
