import type { ErrorTrend } from '@english-saas/api-client';
import { Badge, Card } from '@english-saas/ui';
import { Hourglass, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import type { ProgressView } from './useProgressController';

/**
 * Ícone + texto em todo selo: diminuir é bom, aumentar não é, e nada disso
 * depende só da cor.
 */
const TREND: Record<
  ErrorTrend,
  { icon: LucideIcon; tone: 'ok' | 'error' | 'muted' }
> = {
  DECREASING: { icon: TrendingDown, tone: 'ok' },
  STABLE: { icon: Minus, tone: 'muted' },
  INCREASING: { icon: TrendingUp, tone: 'error' },
  NOT_ENOUGH_DATA: { icon: Hourglass, tone: 'muted' },
};

export function ErrorsSection({ errors }: Pick<ProgressView, 'errors'>) {
  return (
    <section aria-labelledby="progress-errors">
      <Card className="flex flex-col gap-4">
        <h2 id="progress-errors" className="font-display text-lg text-ink">
          {t('progress.errors.title')}
        </h2>

        {errors.length === 0 ? (
          <p className="text-sm text-muted">{t('progress.errors.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {errors.map((error) => {
              const trend = TREND[error.trend];
              const TrendIcon = trend.icon;

              return (
                <li key={error.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {error.description}
                    </p>
                    <Badge tone={trend.tone} className="shrink-0 gap-1">
                      <TrendIcon className="size-3.5" aria-hidden="true" />
                      {error.trendLabel}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted">
                    {t('progress.errors.correction')}{' '}
                    <span className="text-ink">{error.correction}</span>
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {t('progress.errors.occurrences', {
                      count: error.occurrences,
                      total: error.opportunities,
                    })}
                  </p>

                  {error.examples.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted">
                        {t('progress.errors.yourExamples')}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {error.examples.map((example) => (
                          <li
                            key={example}
                            className="rounded-lg bg-ground px-3 py-1.5 text-sm italic text-ink"
                          >
                            &ldquo;{example}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
