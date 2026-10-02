import { BarChart, Card } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { BAR_SCALE } from '../lib/level-scale';
import type { ProgressView } from './useProgressController';

export function LevelSection({
  overall,
  levelBars,
}: Pick<ProgressView, 'overall' | 'levelBars'>) {
  return (
    <section aria-labelledby="progress-level" className="flex flex-col gap-4">
      <h2 id="progress-level" className="sr-only">
        {t('progress.level.title')}
      </h2>

      <Card className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10 font-display text-3xl text-accent"
        >
          {overall.level}
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-muted">
            {t('progress.level.overallPrefix')}
          </p>
          <p className="font-display text-xl text-ink">
            {overall.level} · {overall.label}
          </p>
          <p className="text-sm text-muted">{overall.note}</p>
        </div>
      </Card>

      <Card>
        <BarChart
          title={t('progress.level.chartTitle')}
          description={t('progress.level.chartDescription')}
          items={levelBars}
          scale={BAR_SCALE}
          rowHeader={t('progress.level.rowHeader')}
          valueHeader={t('progress.level.valueHeader')}
          solidLegend={t('progress.level.solidLegend')}
          hatchedLegend={t('progress.level.hatchedLegend')}
          emptyLabel={t('progress.level.empty')}
        />
      </Card>
    </section>
  );
}
