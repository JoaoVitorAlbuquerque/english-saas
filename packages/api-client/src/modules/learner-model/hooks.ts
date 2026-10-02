import { useQuery } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as learnerModelService from './service';
import type { LearnerProfile } from './schemas';

export function useLearnerProfile() {
  return useQuery<LearnerProfile, ApiError>({
    queryKey: queryKeys.meLearnerProfile,
    queryFn: () => learnerModelService.getLearnerProfile(),
  });
}
