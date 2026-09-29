import type { AgendaBlock } from '@english-saas/api-client';
import { Badge, Button, Card } from '@english-saas/ui';
import { CheckCircle2, Dumbbell, RotateCcw, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { t } from '../../../messages/pt-BR';

const ICON_BY_TYPE: Record<AgendaBlock['type'], LucideIcon> = {
  REVIEW: RotateCcw,
  LESSON: CheckCircle2,
  PRACTICE: Dumbbell,
};

function titleFor(block: AgendaBlock): string {
  if (block.type === 'REVIEW') return t('today.block.review.title');
  if (block.type === 'PRACTICE') return t('today.block.practice.title');
  return block.title ?? t('today.block.lesson.defaultTitle');
}

export type AgendaBlockCardProps = {
  block: AgendaBlock;
  isNext: boolean;
  onStart: (block: AgendaBlock) => void;
  onSkip: (block: AgendaBlock) => void;
};

export function AgendaBlockCard({
  block,
  isNext,
  onStart,
  onSkip,
}: AgendaBlockCardProps) {
  const Icon = ICON_BY_TYPE[block.type];
  const isPending = block.status === 'PENDING';

  return (
    <Card
      className={
        isNext
          ? 'border-accent shadow-md'
          : block.status !== 'PENDING'
            ? 'opacity-70'
            : ''
      }
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base text-ink">
              {titleFor(block)}
            </h3>
            {block.status === 'COMPLETED' ? (
              <Badge tone="ok">{t('today.block.statusDone')}</Badge>
            ) : null}
            {block.status === 'SKIPPED' ? (
              <Badge tone="muted">{t('today.block.statusSkipped')}</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted">{block.reason}</p>
          <p className="mt-1 text-xs text-muted">
            {Math.ceil(block.estimatedMinutes)} min
          </p>

          {isPending ? (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant={isNext ? 'primary' : 'ghost'}
                onClick={() => onStart(block)}
              >
                {t('today.startButton')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<X className="size-4" aria-hidden="true" />}
                onClick={() => onSkip(block)}
              >
                {t('today.block.skip')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
