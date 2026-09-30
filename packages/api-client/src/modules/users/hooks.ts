import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as usersService from './service';
import type {
  CompleteOnboardingRequest,
  CompleteOnboardingResponse,
  ConsentView,
  UpdateConsentRequest,
} from './schemas';

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.meProfile,
    queryFn: () => usersService.getProfile(),
  });
}

export function useInterests() {
  return useQuery({
    queryKey: queryKeys.meInterests,
    queryFn: () => usersService.getInterests(),
  });
}

/**
 * Atualiza o cache do perfil no sucesso — as guardas de onboarding leem essa
 * mesma chave e precisam ver `onboardingCompletedAt` novo sem esperar um
 * refetch, senão piscam entre rotas na hora da navegação.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation<
    CompleteOnboardingResponse,
    ApiError,
    CompleteOnboardingRequest
  >({
    mutationFn: (input) => usersService.completeOnboarding(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.meProfile, profile);
    },
  });
}

export function useUpdateConsent() {
  return useMutation<ConsentView[], ApiError, UpdateConsentRequest>({
    mutationFn: (input) => usersService.updateConsent(input),
  });
}
