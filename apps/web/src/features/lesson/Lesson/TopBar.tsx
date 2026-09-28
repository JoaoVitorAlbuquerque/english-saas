import type { CatalogLesson } from '@english-saas/api-client';
import { StepDots } from '@english-saas/ui';
import { X } from 'lucide-react';

import { t } from '../../../messages/pt-BR';

export type TopBarProps = {
  lesson: CatalogLesson;
  stepIndex: number;
  totalSteps: number;
  sessionXp: number;
  onExit: () => void;
};

export function TopBar({
  lesson,
  stepIndex,
  totalSteps,
  sessionXp,
  onExit,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label={t('lesson.topBar.exit')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">
            {lesson.level.cefrLevel} · {lesson.unit.title}
          </p>
          <p className="truncate text-sm font-medium text-ink">
            {lesson.title}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          {sessionXp} XP
        </span>
      </div>

      <StepDots
        total={totalSteps}
        current={Math.min(stepIndex, totalSteps - 1)}
        className="mx-auto mt-3 max-w-2xl justify-center"
      />
    </header>
  );
}
