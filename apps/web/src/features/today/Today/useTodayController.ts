import {
  useAgenda,
  useCompleteAgendaBlock,
  useForecast,
  usePlan,
  useRebuildPlan,
  useSkipAgendaBlock,
  useStats,
} from '@english-saas/api-client';
import type { AgendaBlock, AgendaSkipReason } from '@english-saas/api-client';
import { toast } from '@english-saas/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';

function greetingKey(
  hour: number,
):
  | 'today.greeting.morning'
  | 'today.greeting.afternoon'
  | 'today.greeting.evening' {
  if (hour < 12) return 'today.greeting.morning';
  if (hour < 18) return 'today.greeting.afternoon';
  return 'today.greeting.evening';
}

export function useTodayController() {
  const navigate = useNavigate();
  const stats = useStats();
  const agenda = useAgenda();
  const plan = usePlan();
  const forecast = useForecast();
  const skipBlockMutation = useSkipAgendaBlock();
  const completeBlockMutation = useCompleteAgendaBlock();
  const rebuildPlanMutation = useRebuildPlan();

  const [skipTarget, setSkipTarget] = useState<AgendaBlock | null>(null);
  const [isRebuildConfirmOpen, setRebuildConfirmOpen] = useState(false);
  const [practiceTarget, setPracticeTarget] = useState<AgendaBlock | null>(
    null,
  );

  const isLoading = agenda.isLoading;
  const isLoadError = agenda.isError;

  function retryLoad(): void {
    void agenda.refetch();
    void plan.refetch();
    void stats.refetch();
  }

  const isEmptyPlan = plan.isError && plan.error?.code === 'NOT_FOUND';

  const blocks = agenda.data?.blocks ?? [];
  const plannedMinutes = blocks.reduce(
    (sum, block) => sum + block.estimatedMinutes,
    0,
  );
  const doneMinutes = agenda.data?.minutesCompleted ?? 0;
  const nextPendingBlock =
    blocks.find((block) => block.status === 'PENDING') ?? null;
  const allDone = blocks.length > 0 && nextPendingBlock === null;

  function startBlock(block: AgendaBlock): void {
    if (block.type === 'REVIEW') {
      navigate('/revisao', { state: { agendaBlockId: block.id } });
      return;
    }

    if (block.type === 'LESSON') {
      if (block.slug !== undefined) {
        navigate(`/licoes/${block.slug}`);
      }
      return;
    }

    setPracticeTarget(block);
  }

  function closePracticeModal(): void {
    setPracticeTarget(null);
  }

  function finishPracticeBlock(): void {
    if (practiceTarget !== null) {
      completeBlockMutation.mutate({ blockId: practiceTarget.id });
    }
    setPracticeTarget(null);
  }

  function openSkipDialog(block: AgendaBlock): void {
    setSkipTarget(block);
  }

  function closeSkipDialog(): void {
    setSkipTarget(null);
  }

  function confirmSkip(reason?: AgendaSkipReason, note?: string): void {
    if (skipTarget === null) {
      return;
    }

    skipBlockMutation.mutate({
      blockId: skipTarget.id,
      input: { reason, note },
    });
    setSkipTarget(null);
  }

  function openRebuildConfirm(): void {
    setRebuildConfirmOpen(true);
  }

  function closeRebuildConfirm(): void {
    setRebuildConfirmOpen(false);
  }

  function confirmRebuild(): void {
    rebuildPlanMutation.mutate(undefined, {
      onSuccess: () => {
        toast.message({ title: t('today.rebuildConfirm.success') });
      },
    });
    setRebuildConfirmOpen(false);
  }

  return {
    isLoading,
    isLoadError,
    retryLoad,
    isEmptyPlan,
    greetingKey: greetingKey(new Date().getHours()),
    stats: stats.data ?? null,
    blocks,
    plannedMinutes,
    doneMinutes,
    nextPendingBlock,
    allDone,
    startBlock,
    openSkipDialog,
    skipTarget,
    closeSkipDialog,
    confirmSkip,
    isSkipping: skipBlockMutation.isPending,
    practiceTarget,
    closePracticeModal,
    finishPracticeBlock,
    isRebuildConfirmOpen,
    openRebuildConfirm,
    closeRebuildConfirm,
    confirmRebuild,
    isRebuilding: rebuildPlanMutation.isPending,
    paceMessage: forecast.data?.message ?? null,
  };
}
