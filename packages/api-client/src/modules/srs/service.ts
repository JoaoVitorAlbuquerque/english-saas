import { apiFetch } from '../../http/fetch-client';
import {
  reviewAnswerRequestSchema,
  reviewAnswerResultSchema,
  reviewSessionSchema,
  type ReviewAnswerRequest,
  type ReviewAnswerResult,
  type SessionCard,
} from './schemas';

export async function getReviewSession(
  minutes: number,
): Promise<SessionCard[]> {
  return apiFetch(`/reviews/session?minutes=${String(minutes)}`, {
    schema: reviewSessionSchema,
  });
}

export async function answerReviewCard(
  cardId: string,
  input: ReviewAnswerRequest,
): Promise<ReviewAnswerResult> {
  const body = reviewAnswerRequestSchema.parse(input);

  return apiFetch(`/reviews/${cardId}/answer`, {
    method: 'POST',
    body,
    schema: reviewAnswerResultSchema,
  });
}
