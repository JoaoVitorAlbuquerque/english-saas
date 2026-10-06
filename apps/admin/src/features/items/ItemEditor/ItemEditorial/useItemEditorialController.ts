import {
  type AdminItemDetail,
  type ApiError,
  useTransitionItem,
} from '@english-saas/api-client';
import type { ContentStatus } from '@english-saas/shared';
import { toast } from '@english-saas/ui';
import { useState } from 'react';

import { t } from '../../../../messages/pt-BR';
import {
  availableActions,
  needsConfirmation,
  type EditorialAction,
} from '../../../curriculum/lib/editorial';
import { describeItemError, type ItemProblem } from '../../lib/item-editorial';

export type UseItemEditorialControllerInput = {
  itemId: string;
  status: ContentStatus;
  /**
   * Antes de cada ação: salva o que está no formulário. Devolve `false` se
   * não deu (conteúdo inválido, erro do servidor) — e então nada é movido.
   */
  beforeAction?: () => Promise<boolean>;
  onTransitioned?: (item: AdminItemDetail) => void;
};

/**
 * Enviar, aprovar, devolver, publicar e arquivar um item: o mesmo caminho da
 * versão de lição. Publicar e arquivar pedem confirmação; o que a API
 * recusar vira um painel legível, não um erro genérico.
 */
export function useItemEditorialController({
  itemId,
  status,
  beforeAction,
  onTransitioned,
}: UseItemEditorialControllerInput) {
  const transition = useTransitionItem();
  const [confirming, setConfirming] = useState<EditorialAction | null>(null);
  const [problem, setProblem] = useState<ItemProblem | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  async function perform(action: EditorialAction): Promise<void> {
    setProblem(null);
    setIsPreparing(true);

    let ready = true;

    try {
      ready = (await beforeAction?.()) ?? true;
    } finally {
      setIsPreparing(false);
    }

    if (!ready) {
      setConfirming(null);

      return;
    }

    transition.mutate(
      { id: itemId, action },
      {
        onSuccess: (item) => {
          toast.success({ title: t(`items.editorial.done.${action}`) });
          onTransitioned?.(item);
        },
        onError: (error: ApiError) => setProblem(describeItemError(error)),
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
    problem,
    dismissProblem: () => setProblem(null),
    isWorking: isPreparing || transition.isPending,
    pendingAction: transition.isPending ? transition.variables.action : null,
  };
}
