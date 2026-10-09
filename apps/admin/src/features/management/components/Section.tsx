import type { ApiError } from '@english-saas/api-client';
import { Card, ErrorState, Skeleton } from '@english-saas/ui';
import type { ReactNode } from 'react';

import { t } from '../../../messages/pt-BR';

export type SectionProps = {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  isLoading?: boolean;
  error?: ApiError | null;
  onRetry?: () => void;
  children?: ReactNode;
};

/**
 * Um bloco da ficha: título, carregando e erro **próprios**. Uma parte que
 * falha mostra o erro aqui e não derruba as outras.
 */
export function Section({
  id,
  title,
  description,
  actions,
  isLoading = false,
  error = null,
  onRetry,
  children,
}: SectionProps) {
  return (
    <Card role="region" aria-labelledby={id} className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="font-display text-lg text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      ) : error ? (
        <ErrorState
          title={t('student.sectionError')}
          description={error.message}
          onRetry={onRetry}
        />
      ) : (
        children
      )}
    </Card>
  );
}
