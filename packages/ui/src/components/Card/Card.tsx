import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface p-4 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
