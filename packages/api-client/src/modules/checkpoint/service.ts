import { apiFetch } from '../../http/fetch-client';
import {
  checkpointAnswerRequestSchema,
  checkpointStateSchema,
  type CheckpointAnswerRequest,
  type CheckpointState,
} from './schemas';

export async function startCheckpoint(
  unitId: string,
): Promise<CheckpointState> {
  return apiFetch(`/checkpoints/${unitId}/start`, {
    method: 'POST',
    schema: checkpointStateSchema,
  });
}

export async function answerCheckpoint(
  checkpointId: string,
  input: CheckpointAnswerRequest,
): Promise<CheckpointState> {
  const body = checkpointAnswerRequestSchema.parse(input);

  return apiFetch(`/checkpoints/${checkpointId}/answer`, {
    method: 'POST',
    body,
    schema: checkpointStateSchema,
  });
}
