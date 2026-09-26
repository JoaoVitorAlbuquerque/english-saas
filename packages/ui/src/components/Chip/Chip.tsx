import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function Chip({
  selected = false,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 min-w-11 items-center justify-center rounded-full border px-3.5 text-sm font-medium transition-colors',
        selected
          ? 'border-accent bg-accent text-white'
          : 'border-line bg-surface text-ink hover:bg-ground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
