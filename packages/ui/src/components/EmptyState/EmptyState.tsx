import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center',
        className,
      )}
    >
      <span className="text-muted" aria-hidden="true">
        {icon ?? <Inbox className="size-8" />}
      </span>
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
