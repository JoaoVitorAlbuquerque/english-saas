import {
  type AdminVersion,
  type ApiError,
  useTransitionVersion,
} from '@english-saas/api-client';
import type { ContentStatus } from '@english-saas/shared';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../messages/pt-BR';
import {
  availableActions,
  describeEditorialError,
  needsConfirmation,
  type EditorialAction,
  type EditorialProblem,
} from '../lib/editorial';

export type UseEditorialControllerInput = {
  versionId: string;
  status: ContentStatus;
  /** Antes de cada ação: o editor descarrega o salvamento automático aqui. */
  beforeAction?: () => Promise<void>;
  onTransitioned?: (version: AdminVersion) => void;
};

/**
 * Enviar, aprovar, devolver, publicar e arquivar uma versão — o mesmo
 * comportamento na barra do editor e na lista de versões da lição.
 */
export function useEditorialController({
  versionId,
  status,
  beforeAction,
  onTransitioned,
}: UseEditorialControllerInput) {
  const transition = useTransitionVersion();
  const [confirming, setConfirming] = useState<EditorialAction | null>(null);
  const [problem, setProblem] = useState<EditorialProblem | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  async function perform(action: EditorialAction): Promise<void> {
    setProblem(null);
    setIsPreparing(true);

    try {
      await beforeAction?.();
    } finally {
      setIsPreparing(false);
    }

    transition.mutate(
      { id: versionId, action },
      {
        onSuccess: (version) => {
          toast.success({ title: t(`editorial.done.${action}`) });
          onTransitioned?.(version);
        },
        onError: (error: ApiError) => setProblem(describeEditorialError(error)),
        onSettled: () => setConfirming(null),
      },
    );
  }

  function request(action: EditorialAction): void {
    if (needsConfirmation(action)) {
      setConfirming(action);
    } else {
      void perform(action);
    }
  }

  return {
    actions: availableActions(status),
    request,
    confirming,
    confirm: () => {
      if (confirming !== null) {
        void perform(confirming);
      }
    },
    cancelConfirm: () => setConfirming(null),
    isRunning: transition.isPending || isPreparing,
    problem,
    dismissProblem: () => setProblem(null),
  };
}
