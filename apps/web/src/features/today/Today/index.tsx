import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { AgendaBlockCard } from './AgendaBlockCard';
import { PracticeBlockModal } from './PracticeBlockModal';
import { RebuildConfirmDialog } from './RebuildConfirmDialog';
import { SkipBlockDialog } from './SkipBlockDialog';
import { useTodayController } from './useTodayController';

export function Today() {
  const {
    isLoading,
    isLoadError,
    retryLoad,
    isEmptyPlan,
    greetingKey,
    stats,
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
    isSkipping,
    practiceTarget,
    closePracticeModal,
    finishPracticeBlock,
    isRebuildConfirmOpen,
    openRebuildConfirm,
    closeRebuildConfirm,
    confirmRebuild,
    isRebuilding,
    paceMessage,
  } = useTodayController();

  if (isEmptyPlan) {
    return (
      <EmptyState
        title={t('today.emptyPlan.title')}
        description={t('today.emptyPlan.description')}
        action={
          <button
            type="button"
            onClick={retryLoad}
            className="text-sm font-medium text-accent underline"
          >
            {t('today.emptyPlan.retry')}
          </button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (isLoadError) {
    return (
      <ErrorState title={t('today.error.loadTitle')} onRetry={retryLoad} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl text-ink">{t(greetingKey)}</h1>
          {stats !== null ? (
            <div className="flex items-center gap-2">
              <Badge tone="accent">{stats.totalXp} XP</Badge>
              {stats.currentStreak > 0 ? (
                <Badge tone="ok">
                  {stats.currentStreak}{' '}
                  {stats.currentStreak === 1 ? 'dia seguido' : 'dias seguidos'}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        {plannedMinutes > 0 ? (
          <ProgressBar
            value={doneMinutes}
            max={plannedMinutes}
            label={`${String(doneMinutes)} de ${String(plannedMinutes)} min hoje`}
          />
        ) : null}
      </Card>

      {paceMessage !== null ? (
        <Card className="flex items-center justify-between gap-3 border-accent/40 bg-accent/5">
          <p className="text-sm text-ink">{paceMessage}</p>
          <button
            type="button"
            onClick={openRebuildConfirm}
            className="shrink-0 text-sm font-medium text-accent underline"
          >
            {t('today.pace.rebuildButton')}
          </button>
        </Card>
      ) : null}

      {blocks.length === 0 ? (
        <EmptyState
          title={t('today.noBlocks.title')}
          description={t('today.noBlocks.description')}
        />
      ) : allDone ? (
        <EmptyState
          title={t('today.allDone.title')}
          description={t('today.allDone.description')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {blocks.map((block) => (
            <AgendaBlockCard
              key={block.id}
              block={block}
              isNext={nextPendingBlock?.id === block.id}
              onStart={startBlock}
              onSkip={openSkipDialog}
            />
          ))}
        </div>
      )}

      <SkipBlockDialog
        open={skipTarget !== null}
        onClose={closeSkipDialog}
        onConfirm={confirmSkip}
        isSkipping={isSkipping}
      />
      <PracticeBlockModal
        block={practiceTarget}
        onClose={closePracticeModal}
        onFinished={finishPracticeBlock}
      />
      <RebuildConfirmDialog
        open={isRebuildConfirmOpen}
        onClose={closeRebuildConfirm}
        onConfirm={confirmRebuild}
        isRebuilding={isRebuilding}
      />
    </div>
  );
}
