import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  ItemRenderer,
  Skeleton,
  StepDots,
  toItemView,
} from '@english-saas/ui';
import { X } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { Flashcard } from './Flashcard';
import { ReviewSummary } from './ReviewSummary';
import { useReviewController } from './useReviewController';

const MINUTE_OPTIONS = [5, 10, 15];

export function Review() {
  const {
    phase,
    cards,
    currentIndex,
    currentCard,
    flipped,
    reviewedCount,
    dueDates,
    loadError,
    isLoading,
    pickMinutes,
    flipCard,
    onAnswerItem,
    itemFeedback,
    continueAfterItem,
    isAnswering,
    selfRate,
    restart,
    remainingDue,
    isExitDialogOpen,
    openExitDialog,
    closeExitDialog,
    confirmExit,
  } = useReviewController();

  if (phase === 'PICK_MINUTES') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <h1 className="font-display text-xl text-ink">
          {t('review.pickMinutes.title')}
        </h1>
        {loadError !== null ? (
          <p className="text-sm text-error">{loadError}</p>
        ) : null}
        <div className="flex gap-2">
          {MINUTE_OPTIONS.map((minutes) => (
            <Chip key={minutes} onClick={() => pickMinutes(minutes)}>
              {minutes} min
            </Chip>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  // Sessão vazia desde o início (nada vencido) — nunca chegou a revisar nada.
  if (phase === 'SUMMARY' && reviewedCount === 0) {
    return (
      <EmptyState
        title={t('review.empty.title')}
        description={t('review.empty.description')}
      />
    );
  }

  if (phase === 'SUMMARY') {
    return (
      <ReviewSummary
        reviewedCount={reviewedCount}
        dueDates={dueDates}
        remainingDue={remainingDue}
        onRestart={restart}
        onFinish={() => confirmExit()}
      />
    );
  }

  if (currentCard === undefined || currentCard === null) {
    return <ErrorState title={t('review.error.loadTitle')} />;
  }

  const exercise = currentCard.exercise;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <StepDots total={cards.length} current={currentIndex} />
        <button
          type="button"
          aria-label={t('review.exit')}
          onClick={openExitDialog}
          className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-ground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {exercise.type === 'ITEM' ? (
        <>
          <ItemRenderer
            key={currentCard.cardId}
            item={toItemView(exercise.item, exercise.item.assets)}
            mode="practice"
            feedback={itemFeedback?.answer ?? null}
            disabled={itemFeedback !== null}
            onAnswer={(payload) => onAnswerItem(exercise.item.id, payload)}
          />
          {itemFeedback !== null ? (
            <Button onClick={continueAfterItem} className="self-end">
              {t('review.continue')}
            </Button>
          ) : null}
        </>
      ) : (
        <Flashcard
          key={currentCard.cardId}
          front={exercise.front}
          back={exercise.back}
          flipped={flipped}
          onFlip={flipCard}
          onRate={selfRate}
          isRating={isAnswering}
        />
      )}

      <Dialog
        open={isExitDialogOpen}
        onOpenChange={(next) => !next && closeExitDialog()}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg text-ink">
            {t('review.exitConfirm.title')}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted">
            {t('review.exitConfirm.description')}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={closeExitDialog}>
              {t('review.exitConfirm.stay')}
            </Button>
            <Button variant="danger" onClick={confirmExit}>
              {t('review.exitConfirm.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
