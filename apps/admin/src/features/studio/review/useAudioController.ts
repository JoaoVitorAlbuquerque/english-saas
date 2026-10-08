import {
  useAddComment,
  useAudioTargets,
  useMediaJob,
  useRegenerateAudio,
  useResolveComment,
  type ApiError,
  type AudioIssueKind,
} from '@english-saas/api-client';
import type { ContentStatus } from '@english-saas/shared';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';

/** A narração só existe depois da aprovação; antes, a aba diz isso. */
export function hasNarration(status: ContentStatus): boolean {
  return (
    status === 'APPROVED' || status === 'PUBLISHED' || status === 'ARCHIVED'
  );
}

/** Nova geração só na versão aprovada (a API recusa nas outras). */
export function canRegenerate(status: ContentStatus): boolean {
  return status === 'APPROVED';
}

export type SpeedChoice = 'normal' | 'slow';

/** Fala mais devagar: o remédio mais comum para pronúncia e entonação confusas. */
const SLOW_RATE = 0.85;

export type MarkingDraft = { key: string; issue: AudioIssueKind; note: string };

export function useAudioController({
  versionId,
  status,
}: {
  versionId: string;
  status: ContentStatus;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [speed, setSpeed] = useState<SpeedChoice>('normal');
  const [marking, setMarking] = useState<MarkingDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const job = useMediaJob(jobId);
  const jobState = job.data?.state;
  const generating =
    jobId !== null &&
    (jobState === undefined || jobState === 'waiting' || jobState === 'active');
  const query = useAudioTargets(versionId, {
    enabled: hasNarration(status),
    poll: status === 'APPROVED',
    busy: generating,
  });
  const regenerate = useRegenerateAudio(versionId);
  const addComment = useAddComment(versionId);
  const resolve = useResolveComment(versionId);

  const targets = query.data?.targets ?? [];
  const openIssues = targets.reduce(
    (sum, target) => sum + target.openIssues.length,
    0,
  );

  function request(keys: readonly string[]): void {
    setActionError(null);
    regenerate.mutate(
      {
        keys: [...keys],
        ...(speed === 'slow' ? { speakingRate: SLOW_RATE } : {}),
      },
      {
        onSuccess: (started) => {
          setJobId(started.jobId);
          setSelected([]);
          toast.success({ title: t('studio.audio.regenerating') });
        },
        onError: (error: ApiError) => setActionError(error.message),
      },
    );
  }

  function submitMarking(): void {
    if (marking === null) {
      return;
    }

    setActionError(null);
    addComment.mutate(
      {
        target: 'AUDIO',
        targetRef: marking.key,
        audioIssue: marking.issue,
        body: marking.note.trim(),
      },
      {
        onSuccess: () => {
          setMarking(null);
          toast.success({ title: t('studio.audio.marked') });
        },
        onError: (error: ApiError) => setActionError(error.message),
      },
    );
  }

  return {
    data: query.data ?? null,
    targets,
    isLoading: hasNarration(status) && query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
    refresh: () => void query.refetch(),
    isRefreshing: query.isFetching && !query.isPending,
    /** Quantas falas ainda estão sem áudio. */
    pending: query.data?.pending ?? 0,
    total: query.data?.total ?? 0,
    openIssues,
    generating,
    jobFailed: jobState === 'failed' ? (job.data?.failedReason ?? '') : null,
    selected,
    toggleSelected: (key: string) =>
      setSelected((current) =>
        current.includes(key)
          ? current.filter((entry) => entry !== key)
          : [...current, key],
      ),
    speed,
    setSpeed,
    regenerateOne: (key: string) => request([key]),
    regenerateSelected: () => request(selected),
    isRequesting: regenerate.isPending,
    marking,
    startMarking: (key: string) =>
      setMarking({ key, issue: 'PRONUNCIATION', note: '' }),
    changeMarking: (change: Partial<Omit<MarkingDraft, 'key'>>) =>
      setMarking((current) =>
        current === null ? current : { ...current, ...change },
      ),
    cancelMarking: () => setMarking(null),
    submitMarking,
    isMarking: addComment.isPending,
    resolveIssue: (id: string) =>
      resolve.mutate(id, {
        onError: (error: ApiError) => setActionError(error.message),
      }),
    actionError,
  };
}

export type AudioController = ReturnType<typeof useAudioController>;
