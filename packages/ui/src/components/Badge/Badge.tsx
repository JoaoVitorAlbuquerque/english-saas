import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type BadgeTone = 'accent' | 'ok' | 'error' | 'muted';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  accent: 'bg-accent/10 text-accent',
  ok: 'bg-ok/10 text-ok',
  error: 'bg-error/10 text-error',
  muted: 'bg-line/50 text-muted',
};

export function Badge({ tone = 'muted', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
