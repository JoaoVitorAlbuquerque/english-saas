import type { Interest } from '@english-saas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as usersService from './service';
import type {
  CompleteOnboardingRequest,
  CompleteOnboardingResponse,
  ConsentView,
  DataExportView,
  DeleteAccountResponse,
  StudentProfile,
  UpdateAccountRequest,
  UpdateAccountResponse,
  UpdateConsentRequest,
  UpdateProfileRequest,
} from './schemas';

/** Enquanto o arquivo é montado na fila, pergunta de novo a cada 3 s. */
const EXPORT_POLL_MS = 3_000;

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

export function useUpdateAccount() {
  return useMutation<UpdateAccountResponse, ApiError, UpdateAccountRequest>({
    mutationFn: (input) => usersService.updateAccount(input),
  });
}

/** Mesma razão do `useCompleteOnboarding`: quem lê o perfil vê o novo na hora. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<StudentProfile, ApiError, UpdateProfileRequest>({
    mutationFn: (input) => usersService.updateProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.meProfile, profile);
    },
  });
}

export function useReplaceInterests() {
  const queryClient = useQueryClient();

  return useMutation<Interest[], ApiError, Interest[]>({
    mutationFn: (interests) => usersService.replaceInterests(interests),
    onSuccess: (interests) => {
      queryClient.setQueryData(queryKeys.meInterests, interests);
    },
  });
}

export function useConsents() {
  return useQuery<ConsentView[], ApiError>({
    queryKey: queryKeys.meConsents,
    queryFn: () => usersService.listConsents(),
  });
}

export function useUpdateConsent() {
  const queryClient = useQueryClient();

  return useMutation<ConsentView[], ApiError, UpdateConsentRequest>({
    mutationFn: (input) => usersService.updateConsent(input),
    onSuccess: (consents) => {
      queryClient.setQueryData(queryKeys.meConsents, consents);
    },
  });
}

/**
 * O export mais recente (`null` se nunca houve). Enquanto estiver PENDING,
 * refaz a consulta sozinho; ao sair da tela o polling para com a query, e
 * ao voltar a tela retoma de onde estava.
 */
export function useLatestExport() {
  return useQuery<DataExportView | null, ApiError>({
    queryKey: queryKeys.meExport,
    queryFn: () => usersService.getLatestExport(),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ? EXPORT_POLL_MS : false,
  });
}

export function useRequestExport() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, ApiError, void>({
    mutationFn: () => usersService.requestExport(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.meExport }),
  });
}

export function useDeleteAccount() {
  return useMutation<DeleteAccountResponse, ApiError, void>({
    mutationFn: () => usersService.deleteAccount(),
  });
}
