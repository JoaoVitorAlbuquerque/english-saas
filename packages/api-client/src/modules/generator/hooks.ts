import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import type { ApiError } from '../../http/api-error';
import { queryKeys } from '../../query/query-keys';
import { usePollJob } from '../../query/use-poll-job';
import type { AnswerResult } from '../answers/schemas';
import * as generatorService from './service';
import {
  FINAL_GENERATION_STATUSES,
  generationJobSchema,
  type GenerateTopicRequest,
  type GenerationJob,
  type IngestRequest,
  type MaterialAnswerRequest,
  type MaterialDetail,
  type MaterialFeedback,
  type MaterialFeedbackRequest,
  type SuggestTopicsRequest,
  type TermReviewState,
} from './schemas';

/** Pedido novo: o job volta em QUEUED e já entra no cache do polling. */
function useCreateJob<TInput>(
  request: (input: TInput) => Promise<GenerationJob>,
  { spendsCredits }: { spendsCredits: boolean },
) {
  const queryClient = useQueryClient();

  return useMutation<GenerationJob, ApiError, TInput>({
    mutationFn: request,
    onSuccess: (job) => {
      queryClient.setQueryData(queryKeys.generationJob(job.id), job);
      if (spendsCredits) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.meCredits });
      }
    },
  });
}

export function useSuggestTopics() {
  return useCreateJob<SuggestTopicsRequest>(generatorService.suggestTopics, {
    spendsCredits: false,
  });
}

export function useGenerateTopic() {
  return useCreateJob<GenerateTopicRequest>(generatorService.generateTopic, {
    spendsCredits: true,
  });
}

export function useIngestContent() {
  return useCreateJob<IngestRequest>(generatorService.ingestContent, {
    spendsCredits: true,
  });
}

/**
 * Acompanha o pedido até DONE/FAILED/REFUSED. Ao terminar, o saldo pode ter
 * mudado (estorno) e a lista de materiais ganhou um — as duas recarregam.
 */
export function useGenerationJob(id: string | null) {
  const queryClient = useQueryClient();
  const query = usePollJob<GenerationJob>({
    queryKey: queryKeys.generationJob(id ?? 'none'),
    fetchJob: () => generatorService.getGenerationJob(id as string),
    schema: generationJobSchema,
    enabled: id !== null,
    isDone: (job) => FINAL_GENERATION_STATUSES.includes(job.status),
    intervalMs: 2_000,
  });
  const finished =
    query.data !== undefined &&
    FINAL_GENERATION_STATUSES.includes(query.data.status);

  useEffect(() => {
    if (finished) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meCredits });
      void queryClient.invalidateQueries({ queryKey: queryKeys.meMaterials });
    }
  }, [finished, queryClient]);

  return query;
}

export function useMaterials() {
  return useInfiniteQuery({
    queryKey: queryKeys.meMaterials,
    queryFn: ({ pageParam }) =>
      generatorService.listMaterials({
        limit: 20,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : null),
  });
}

export function useMaterial(id: string) {
  return useQuery<MaterialDetail, ApiError>({
    queryKey: queryKeys.material(id),
    queryFn: () => generatorService.getMaterial(id),
  });
}

export function useAnswerMaterialItem(materialId: string) {
  return useMutation<AnswerResult, ApiError, MaterialAnswerRequest>({
    mutationFn: (input) =>
      generatorService.answerMaterialItem(materialId, input),
  });
}

export function useRateMaterial(materialId: string) {
  const queryClient = useQueryClient();

  return useMutation<MaterialFeedback, ApiError, MaterialFeedbackRequest>({
    mutationFn: (input) => generatorService.rateMaterial(materialId, input),
    onSuccess: (feedback) => {
      queryClient.setQueryData<MaterialDetail>(
        queryKeys.material(materialId),
        (current) =>
          current && {
            ...current,
            feedback: {
              rating: feedback.rating,
              difficulty: feedback.difficulty,
            },
          },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.meMaterials });
    },
  });
}

/** Põe ou tira um termo da revisão e atualiza o `inReview` no cache. */
export function useSetTermInReview(materialId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    TermReviewState,
    ApiError,
    { termKey: string; inReview: boolean }
  >({
    mutationFn: ({ termKey, inReview }) =>
      generatorService.setTermInReview(materialId, termKey, inReview),
    onSuccess: (state) => {
      queryClient.setQueryData<MaterialDetail>(
        queryKeys.material(materialId),
        (current) =>
          current && {
            ...current,
            content: {
              ...current.content,
              vocabulary: current.content.vocabulary.map((entry) =>
                entry.termKey === state.termKey
                  ? { ...entry, inReview: state.inReview }
                  : entry,
              ),
            },
          },
      );
    },
  });
}
