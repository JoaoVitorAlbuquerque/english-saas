import { Button, Card } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

export type FlashcardProps = {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  onRate: (rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY') => void;
  isRating: boolean;
};

export function Flashcard({
  front,
  back,
  flipped,
  onFlip,
  onRate,
  isRating,
}: FlashcardProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card
        role="button"
        tabIndex={0}
        onClick={flipped ? undefined : onFlip}
        onKeyDown={(event) => {
          if (!flipped && (event.key === 'Enter' || event.key === ' ')) {
            onFlip();
          }
        }}
        className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"
      >
        <p className="font-display text-2xl text-ink">{front}</p>
        {flipped ? (
          <p className="border-t border-line pt-3 text-lg text-muted">{back}</p>
        ) : null}
      </Card>

      {!flipped ? (
        <Button onClick={onFlip} className="self-center">
          {t('review.flashcard.flip')}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            variant="danger"
            disabled={isRating}
            onClick={() => onRate('AGAIN')}
          >
            {t('review.flashcard.again')}
          </Button>
          <Button
            variant="ghost"
            disabled={isRating}
            onClick={() => onRate('HARD')}
          >
            {t('review.flashcard.hard')}
          </Button>
          <Button disabled={isRating} onClick={() => onRate('GOOD')}>
            {t('review.flashcard.good')}
          </Button>
          <Button disabled={isRating} onClick={() => onRate('EASY')}>
            {t('review.flashcard.easy')}
          </Button>
        </div>
      )}
    </div>
  );
}
