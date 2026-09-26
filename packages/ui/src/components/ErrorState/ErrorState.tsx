import { AlertTriangle } from 'lucide-react';

import { cn } from '../../lib/cn';
import { Button } from '../Button/Button';

export type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = 'Algo deu errado',
  description = 'Tente de novo em alguns instantes.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-error/30 bg-error/5 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="size-8 text-error" aria-hidden="true" />
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {onRetry ? (
        <Button variant="ghost" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}
