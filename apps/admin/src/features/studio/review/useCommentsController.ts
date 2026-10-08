import {
  useAddComment,
  useResolveComment,
  useVersionComments,
  type ApiError,
  type Comment,
} from '@english-saas/api-client';
import { LESSON_STEP_TYPE_LABELS } from '@english-saas/shared';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import type { QaStep } from '../lib/qa-path';
import type { CommentAbout } from './ReviewContext';

export const WHOLE_LESSON: CommentAbout = {
  target: 'VERSION',
  ref: null,
  label: '',
};

export function stepLabel(order: number, steps: readonly QaStep[]): string {
  const step = steps[order];

  return step === undefined
    ? t('studio.comments.about.step', { n: order + 1, type: '' }).trim()
    : t('studio.comments.about.step', {
        n: order + 1,
        type: LESSON_STEP_TYPE_LABELS[step.type],
      });
}

/** O que o comentário comenta, em palavras (a questão é resolvida pelo componente). */
export function aboutOf(
  comment: Pick<Comment, 'target' | 'targetRef'>,
  steps: readonly QaStep[],
): { kind: 'version' | 'step' | 'item'; label: string; itemId?: string } {
  if (comment.target === 'STEP' && comment.targetRef !== null) {
    return {
      kind: 'step',
      label: stepLabel(Number(comment.targetRef), steps),
    };
  }

  if (comment.target === 'ITEM' && comment.targetRef !== null) {
    return {
      kind: 'item',
      label: t('studio.comments.about.item'),
      itemId: comment.targetRef,
    };
  }

  return { kind: 'version', label: t('studio.comments.about.version') };
}

/** O valor do `select` "Sobre": `VERSION`, `STEP:2` ou `ITEM:<id>`. */
export function encodeAbout(about: CommentAbout): string {
  return about.target === 'VERSION'
    ? 'VERSION'
    : `${about.target}:${about.ref ?? ''}`;
}

export function useCommentsController({
  versionId,
  steps,
  about,
  setAbout,
}: {
  versionId: string;
  steps: readonly QaStep[];
  about: CommentAbout;
  setAbout: (about: CommentAbout) => void;
}) {
  const [includeResolved, setIncludeResolved] = useState(false);
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const list = useVersionComments(versionId, includeResolved);
  const add = useAddComment(versionId);
  const resolve = useResolveComment(versionId);

  // Problema de áudio vive na aba de áudio.
  const comments = (list.data ?? []).filter(
    (comment) => comment.target !== 'AUDIO',
  );

  function chooseAbout(value: string): void {
    if (value === 'VERSION') {
      setAbout(WHOLE_LESSON);

      return;
    }

    const [target, ref = ''] = value.split(/:(.*)/s);

    if (target === 'STEP') {
      setAbout({
        target: 'STEP',
        ref,
        label: stepLabel(Number(ref), steps),
      });
    } else if (target === 'ITEM') {
      setAbout({ ...about, target: 'ITEM', ref });
    }
  }

  function submit(): void {
    const body = text.trim();

    if (body === '') {
      setTextError(t('studio.comments.errors.empty'));

      return;
    }

    setTextError(null);
    setServerError(null);
    add.mutate(
      { target: about.target, targetRef: about.ref, body },
      {
        onSuccess: () => {
          setText('');
          toast.success({ title: t('studio.comments.added') });
        },
        onError: (error: ApiError) => setServerError(error.message),
      },
    );
  }

  return {
    comments,
    isLoading: list.isPending,
    error: list.error,
    retry: () => void list.refetch(),
    includeResolved,
    setIncludeResolved,
    about,
    chooseAbout,
    clearAbout: () => setAbout(WHOLE_LESSON),
    text,
    setText: (value: string) => {
      setText(value);
      setTextError(null);
    },
    textError,
    serverError,
    submit,
    isAdding: add.isPending,
    resolve: (id: string) =>
      resolve.mutate(id, {
        onError: (error: ApiError) => setServerError(error.message),
      }),
    resolvingId: resolve.isPending ? resolve.variables : null,
  };
}

export type CommentsController = ReturnType<typeof useCommentsController>;
