import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import type { DraftKind } from '@english-saas/shared';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import * as service from './service';
import type {
  AddCommentRequest,
  AudioList,
  Comment,
  Draft,
  DraftEstimate,
  DraftPage,
  MediaJob,
  MediaJobStarted,
  QaReport,
  RegenerateAudioRequest,
  RequestItemsDraft,
  RequestLessonDraft,
  RequestRegisterNotesDraft,
  WorkbookRow,
} from './schemas';

/**
 * Hooks do estúdio de conteúdo.
 *
 * A fila de rascunhos, o áudio e as apostilas **se atualizam sozinhos** (a cada
 * 3 s) enquanto há trabalho em andamento — o backend responde 202 e o job roda
 * na fila. Quando tudo termina, o polling para.
 */

const PAGE_SIZE = 30;
const POLL_MS = 3_000;
const ACTIVE_DRAFT_STATUSES: readonly string[] = [
  'QUEUED',
  'GENERATING',
  'QA_RUNNING',
];

function invalidateDrafts(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: ['admin', 'studio', 'drafts'],
  });
}

// --- Rascunhos ---

export function useDrafts(filter: service.DraftFilter = {}) {
  return useInfiniteQuery<DraftPage, ApiError, InfiniteData<DraftPage>>({
    queryKey: queryKeys.studioDrafts(filter),
    queryFn: ({ pageParam }) =>
      service.listDrafts({
        limit: PAGE_SIZE,
        ...filter,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.data.some((draft) => ACTIVE_DRAFT_STATUSES.includes(draft.status)),
      )
        ? POLL_MS
        : false,
  });
}

export function useRequestLessonDraft() {
  const queryClient = useQueryClient();

  return useMutation<Draft, ApiError, RequestLessonDraft>({
    mutationFn: (input) => service.requestLessonDraft(input),
    onSuccess: () => {
      void invalidateDrafts(queryClient);
    },
  });
}

export function useRequestItemsDraft() {
  const queryClient = useQueryClient();

  return useMutation<Draft, ApiError, RequestItemsDraft>({
    mutationFn: (input) => service.requestItemsDraft(input),
    onSuccess: () => {
      void invalidateDrafts(queryClient);
    },
  });
}

export function useRequestRegisterNotesDraft() {
  const queryClient = useQueryClient();

  return useMutation<Draft, ApiError, RequestRegisterNotesDraft>({
    mutationFn: (input) => service.requestRegisterNotesDraft(input),
    onSuccess: () => {
      void invalidateDrafts(queryClient);
    },
  });
}

export function useDiscardDraft() {
  const queryClient = useQueryClient();

  return useMutation<Draft, ApiError, string>({
    mutationFn: (id) => service.discardDraft(id),
    onSuccess: () => {
      void invalidateDrafts(queryClient);
    },
  });
}

/** Custo estimado do pedido; muda com a quantidade. */
export function useDraftEstimate(kind: DraftKind, count: number) {
  return useQuery<DraftEstimate, ApiError>({
    queryKey: queryKeys.studioEstimate(kind, count),
    queryFn: () => service.estimateDraft(kind, count),
    staleTime: 60_000,
  });
}

// --- Revisão automática ---

/** `null` = a revisão ainda não rodou nesta versão. */
export function useQaReport(lessonVersionId: string, enabled = true) {
  return useQuery<QaReport | null, ApiError>({
    queryKey: queryKeys.studioQa(lessonVersionId),
    queryFn: () => service.getQaReport(lessonVersionId),
    enabled,
  });
}

export function useRunQa(lessonVersionId: string) {
  const queryClient = useQueryClient();

  return useMutation<QaReport, ApiError, void>({
    mutationFn: () => service.runQa(lessonVersionId),
    onSuccess: (report) => {
      queryClient.setQueryData(queryKeys.studioQa(lessonVersionId), report);
    },
  });
}

// --- Comentários ---

export function useVersionComments(
  lessonVersionId: string,
  includeResolved = false,
) {
  return useQuery<Comment[], ApiError>({
    queryKey: queryKeys.studioComments(lessonVersionId, includeResolved),
    queryFn: () => service.listComments(lessonVersionId, includeResolved),
  });
}

/** Comentário novo ou resolvido muda as duas listas: a de comentários e a de áudio. */
function invalidateReview(
  queryClient: QueryClient,
  lessonVersionId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: ['admin', 'studio', 'comments', lessonVersionId],
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.studioAudio(lessonVersionId),
  });
}

export function useAddComment(lessonVersionId: string) {
  const queryClient = useQueryClient();

  return useMutation<Comment, ApiError, AddCommentRequest>({
    mutationFn: (input) => service.addComment(lessonVersionId, input),
    onSuccess: () => invalidateReview(queryClient, lessonVersionId),
  });
}

export function useResolveComment(lessonVersionId: string) {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, string>({
    mutationFn: (id) => service.resolveComment(id),
    onSuccess: () => invalidateReview(queryClient, lessonVersionId),
  });
}

// --- Áudio ---

/**
 * `poll`: atualiza a cada 3 s enquanto há fala sem áudio (a narração roda na
 * fila depois da aprovação) ou enquanto `busy` (uma nova geração em curso).
 */
export function useAudioTargets(
  lessonVersionId: string,
  options: { enabled?: boolean; poll?: boolean; busy?: boolean } = {},
) {
  const { enabled = true, poll = false, busy = false } = options;

  return useQuery<AudioList, ApiError>({
    queryKey: queryKeys.studioAudio(lessonVersionId),
    queryFn: () => service.getAudio(lessonVersionId),
    enabled,
    refetchInterval: (query) =>
      busy || (poll && (query.state.data?.pending ?? 0) > 0) ? POLL_MS : false,
  });
}

export function useRegenerateAudio(lessonVersionId: string) {
  return useMutation<MediaJobStarted, ApiError, RegenerateAudioRequest>({
    mutationFn: (input) => service.regenerateAudio(lessonVersionId, input),
  });
}

// --- Apostilas e jobs ---

export function useStudioWorkbooks(options: { poll?: boolean } = {}) {
  return useQuery<WorkbookRow[], ApiError>({
    queryKey: queryKeys.studioWorkbooks,
    queryFn: () => service.listWorkbooks(),
    refetchInterval: options.poll === true ? POLL_MS : false,
  });
}

export function useRegenerateWorkbook() {
  return useMutation<MediaJobStarted, ApiError, string>({
    mutationFn: (unitId) => service.regenerateWorkbook(unitId),
  });
}

/**
 * Estado de um job da fila de mídia, de 2 em 2 s até ele terminar. Quando
 * termina, refaz as listas de áudio e de apostilas — é onde o resultado aparece.
 */
export function useMediaJob(jobId: string | null) {
  const queryClient = useQueryClient();

  return useQuery<MediaJob, ApiError>({
    queryKey: queryKeys.studioJob(jobId ?? 'none'),
    queryFn: async () => {
      const job = await service.getMediaJob(jobId ?? '');

      // Terminou (ou já foi limpo da fila): o resultado está nas listas.
      if (job.state !== 'waiting' && job.state !== 'active') {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.studioWorkbooks,
        });
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'studio', 'audio'],
        });
      }

      return job;
    },
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const state = query.state.data?.state;

      return state === undefined || state === 'waiting' || state === 'active'
        ? 2_000
        : false;
    },
  });
}
