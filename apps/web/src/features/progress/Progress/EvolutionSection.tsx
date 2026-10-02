import { Badge, Card, Chip, LineChart } from '@english-saas/ui';
import { Check, Clock, Hourglass, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PaceStatus } from '@english-saas/api-client';

import { t } from '../../../messages/pt-BR';
import { LINE_SCALE, levelAt, levelValue } from '../lib/level-scale';
import type { ProgressView } from './useProgressController';

const FORECAST_ICON: Record<PaceStatus, LucideIcon> = {
  ON_TRACK: Check,
  AHEAD: TrendingUp,
  BEHIND: Clock,
  TOO_EARLY: Hourglass,
  NO_STUDY: Hourglass,
  NO_PLAN: Hourglass,
};

const FORECAST_TONE: Record<PaceStatus, 'ok' | 'muted'> = {
  ON_TRACK: 'ok',
  AHEAD: 'ok',
  BEHIND: 'muted',
  TOO_EARLY: 'muted',
  NO_STUDY: 'muted',
  NO_PLAN: 'muted',
};

export function EvolutionSection({
  evolution,
  forecast,
}: Pick<ProgressView, 'evolution' | 'forecast'>) {
  const StatusIcon = FORECAST_ICON[forecast.status];

  return (
    <section
      aria-labelledby="progress-evolution"
      className="flex flex-col gap-4"
    >
      <Card className="flex flex-col gap-4">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('progress.evolution.title')}
        >
          {evolution.focusOptions.map((option) => (
            <Chip
              key={option.value}
              selected={evolution.focus === option.value}
              onClick={() => evolution.setFocus(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>

        <LineChart
          title={t('progress.evolution.title')}
          description={t('progress.evolution.description')}
          scale={LINE_SCALE}
          formatY={(value) => levelAt(value) ?? String(value)}
          rowHeader={t('progress.evolution.rowHeader')}
          emptyLabel={t('progress.evolution.empty')}
          referenceLine={
            evolution.targetLevel === null
              ? undefined
              : {
                  value: levelValue(evolution.targetLevel),
                  label: t('progress.evolution.target', {
                    level: evolution.targetLevel,
                  }),
                }
          }
          series={[
            {
              id: evolution.focus,
              label: evolution.seriesLabel,
              points: evolution.points,
            },
          ]}
        />
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="progress-evolution" className="font-display text-lg text-ink">
            {t('progress.forecast.title')}
          </h2>
          <Badge tone={FORECAST_TONE[forecast.status]} className="gap-1">
            <StatusIcon className="size-3.5" aria-hidden="true" />
            {forecast.statusLabel}
          </Badge>
        </div>
        <p className="text-sm text-ink">{forecast.message}</p>
        {forecast.targetLevel !== null ||
        forecast.byPlan !== null ||
        forecast.byPace !== null ? (
          <ul className="flex flex-col gap-0.5 text-sm text-muted">
            {forecast.targetLevel !== null ? (
              <li>
                {t('progress.forecast.target', { level: forecast.targetLevel })}
              </li>
            ) : null}
            {forecast.byPlan !== null ? (
              <li>
                {t('progress.forecast.byPlan', { date: forecast.byPlan })}
              </li>
            ) : null}
            {forecast.byPace !== null ? (
              <li>
                {t('progress.forecast.byPace', { date: forecast.byPace })}
              </li>
            ) : null}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
