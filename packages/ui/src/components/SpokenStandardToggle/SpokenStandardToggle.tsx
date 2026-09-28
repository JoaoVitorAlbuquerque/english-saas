import { useState } from 'react';

import { cn } from '../../lib/cn';

export type SpokenStandardToggleProps = {
  spoken: string;
  standard: string;
  className?: string;
};

type View = 'spoken' | 'standard';

/** Alterna "Como se fala" × "Estrutura gramatical" — usado em cenas, cards e feedback. */
export function SpokenStandardToggle({
  spoken,
  standard,
  className,
}: SpokenStandardToggleProps) {
  const [view, setView] = useState<View>('spoken');

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="group"
        aria-label="Como se fala ou estrutura gramatical"
        className="flex gap-1"
      >
        <button
          type="button"
          aria-pressed={view === 'spoken'}
          onClick={() => setView('spoken')}
          className={cn(
            'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
            view === 'spoken'
              ? 'border-accent bg-accent text-white'
              : 'border-line bg-surface text-ink hover:bg-ground',
          )}
        >
          Como se fala
        </button>
        <button
          type="button"
          aria-pressed={view === 'standard'}
          onClick={() => setView('standard')}
          className={cn(
            'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
            view === 'standard'
              ? 'border-accent bg-accent text-white'
              : 'border-line bg-surface text-ink hover:bg-ground',
          )}
        >
          Estrutura gramatical
        </button>
      </div>
      <p className="text-lg text-ink">
        {view === 'spoken' ? spoken : standard}
      </p>
    </div>
  );
}
