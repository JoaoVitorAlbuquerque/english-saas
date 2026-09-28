import { apiFetch } from '../../http/fetch-client';
import {
  placementAnswerRequestSchema,
  placementStateSchema,
  type PlacementAnswerRequest,
  type PlacementState,
} from './schemas';

export async function start(): Promise<PlacementState> {
  return apiFetch('/placement/start', {
    method: 'POST',
    schema: placementStateSchema,
  });
}

export async function answer(
  testId: string,
  input: PlacementAnswerRequest,
): Promise<PlacementState> {
  const body = placementAnswerRequestSchema.parse(input);

  return apiFetch(`/placement/${testId}/answer`, {
    method: 'POST',
    body,
    schema: placementStateSchema,
  });
}

export async function latest(): Promise<PlacementState> {
  return apiFetch('/placement/latest', { schema: placementStateSchema });
}
