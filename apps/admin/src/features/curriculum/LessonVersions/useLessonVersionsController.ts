import {
  type AdminVersion,
  type ApiError,
  useAdminLesson,
  useCreateVersion,
} from '@english-saas/api-client';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { diffVersions } from '../lib/version-diff';
import { isEditableStatus } from '../lib/editorial';

export function useLessonVersionsController() {
  const { lessonId = '' } = useParams();
  const navigate = useNavigate();
  const lesson = useAdminLesson(lessonId);
  const createVersion = useCreateVersion();
  const [createError, setCreateError] = useState<string | null>(null);
  // `null`: segue o padrão (a mais nova contra a anterior).
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);

  const versions = useMemo(
    () =>
      [...(lesson.data?.versions ?? [])].sort((a, b) => b.version - a.version),
    [lesson.data],
  );

  const effectiveTo = toId ?? versions[0]?.id ?? null;
  const effectiveFrom = fromId ?? versions[1]?.id ?? null;
  const fromVersion = versions.find((version) => version.id === effectiveFrom);
  const toVersion = versions.find((version) => version.id === effectiveTo);

  const diff = useMemo(
    () =>
      fromVersion && toVersion && fromVersion.id !== toVersion.id
        ? diffVersions(fromVersion, toVersion)
        : null,
    [fromVersion, toVersion],
  );

  const openVersion: AdminVersion | undefined = versions.find((version) =>
    isEditableStatus(version.status),
  );

  function handleCreateVersion(): void {
    setCreateError(null);
    createVersion.mutate(lessonId, {
      onSuccess: (version) => navigate(`/conteudo/versoes/${version.id}`),
      onError: (error: ApiError) => {
        if (error.code === 'DRAFT_ALREADY_OPEN') {
          const open = (error.details as { version?: number } | undefined)
            ?.version;

          setCreateError(
            open === undefined
              ? error.message
              : t('lesson.draftOpen', { version: open }),
          );
        } else {
          setCreateError(error.message || t('lesson.newVersionError'));
        }
      },
    });
  }

  return {
    isLoading: lesson.isPending,
    error: lesson.error,
    retry: () => void lesson.refetch(),
    lesson: lesson.data ?? null,
    versions,
    title: versions[0]?.title ?? lesson.data?.slug ?? '',
    openVersion,
    createError,
    isCreating: createVersion.isPending,
    createVersion: handleCreateVersion,
    compare: {
      fromId: effectiveFrom,
      toId: effectiveTo,
      setFromId,
      setToId,
      diff,
    },
  };
}
