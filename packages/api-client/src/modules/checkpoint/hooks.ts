import { useMutation } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import * as checkpointService from './service';
import type { CheckpointAnswerRequest, CheckpointState } from './schemas';

export function useStartCheckpoint() {
  return useMutation<CheckpointState, ApiError, string>({
    mutationFn: (unitId) => checkpointService.startCheckpoint(unitId),
  });
}

export function useAnswerCheckpoint() {
  return useMutation<
    CheckpointState,
    ApiError,
    { checkpointId: string; input: CheckpointAnswerRequest }
  >({
    mutationFn: ({ checkpointId, input }) =>
      checkpointService.answerCheckpoint(checkpointId, input),
  });
}
