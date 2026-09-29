import { apiFetch } from '../../http/fetch-client';
import {
  answerResultSchema,
  submitAnswerRequestSchema,
  type AnswerResult,
  type SubmitAnswerRequest,
} from './schemas';

export async function submitAnswer(
  input: SubmitAnswerRequest,
): Promise<AnswerResult> {
  const body = submitAnswerRequestSchema.parse(input);

  return apiFetch('/answers', {
    method: 'POST',
    body,
    schema: answerResultSchema,
  });
}
