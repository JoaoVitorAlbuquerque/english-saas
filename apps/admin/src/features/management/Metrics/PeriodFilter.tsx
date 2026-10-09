import { Button, Input } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { formatFullDay } from '../lib/period';
import type { useMetricsController } from './useMetricsController';

type Controller = ReturnType<typeof useMetricsController>;

/** Atalhos de período (7/30/90/180 dias) e o intervalo livre. */
export function PeriodFilter({ controller }: { controller: Controller }) {
  const period = controller.metrics?.period;

  return (
    <section aria-labelledby="metrics-period" className="space-y-3">
      <h2 id="metrics-period" className="text-sm font-medium text-ink">
        {t('metrics.period')}
      </h2>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-labelledby="metrics-period"
      >
        {controller.presets.map((days) => (
          <Button
            key={days}
            size="sm"
            variant={controller.activePreset === days ? 'primary' : 'ghost'}
            aria-pressed={controller.activePreset === days}
            disabled={days !== 30 && !controller.canUsePresets}
            onClick={() => controller.choosePreset(days)}
          >
            {t('metrics.period.preset', { days })}
          </Button>
        ))}
        <Button
          size="sm"
          variant={
            controller.isCustom || controller.customOpen ? 'primary' : 'ghost'
          }
          aria-pressed={controller.isCustom || controller.customOpen}
          onClick={controller.openCustom}
        >
          {t('metrics.period.custom')}
        </Button>
      </div>

      {controller.customOpen ? (
        <form
          noValidate
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            controller.applyCustom();
          }}
        >
          <div className="w-44">
            <Input
              type="date"
              label={t('metrics.period.from')}
              value={controller.customFrom}
              onChange={(event) => controller.setCustomFrom(event.target.value)}
            />
          </div>
          <div className="w-44">
            <Input
              type="date"
              label={t('metrics.period.to')}
              value={controller.customTo}
              onChange={(event) => controller.setCustomTo(event.target.value)}
            />
          </div>
          <Button type="submit">{t('metrics.period.apply')}</Button>
          {controller.problem ? (
            <p role="alert" className="basis-full text-sm text-error">
              {t(`metrics.period.${controller.problem}`, {
                max: controller.maxDays,
              })}
            </p>
          ) : null}
        </form>
      ) : null}

      {period ? (
        <p className="text-xs text-muted">
          {t('metrics.period.current', {
            from: formatFullDay(period.from),
            to: formatFullDay(period.to),
            days: period.days,
          })}
        </p>
      ) : null}
    </section>
  );
}
