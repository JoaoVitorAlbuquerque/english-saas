import { Chip, ErrorState, Skeleton } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { EmptyProgress } from './EmptyProgress';
import { ErrorsSection } from './ErrorsSection';
import { EvolutionSection } from './EvolutionSection';
import { LevelSection } from './LevelSection';
import { PlanSection } from './PlanSection';
import { StrengthsWeaknessesSection } from './StrengthsWeaknessesSection';
import { useProgressController } from './useProgressController';

export function Progress() {
  const { isLoading, isError, retry, view, weeks, setWeeks, periodOptions } =
    useProgressController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || view === null) {
    return <ErrorState title={t('progress.errorTitle')} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl text-ink">{t('progress.title')}</h1>

        {view.isNewStudent ? null : (
          <div
            role="group"
            aria-label={t('progress.period.label')}
            className="flex flex-wrap gap-2"
          >
            {periodOptions.map((option) => (
              <Chip
                key={option}
                selected={weeks === option}
                onClick={() => setWeeks(option)}
              >
                {t('progress.period.weeks', { count: option })}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {view.isNewStudent ? (
        <EmptyProgress />
      ) : (
        <div
          aria-busy={view.isRefreshing}
          className={
            view.isRefreshing
              ? 'flex flex-col gap-5 opacity-60 transition-opacity'
              : 'flex flex-col gap-5'
          }
        >
          <LevelSection overall={view.overall} levelBars={view.levelBars} />
          <EvolutionSection
            evolution={view.evolution}
            forecast={view.forecast}
          />
          <StrengthsWeaknessesSection
            strengths={view.strengths}
            weaknesses={view.weaknesses}
          />
          <ErrorsSection errors={view.errors} />
          <PlanSection plan={view.plan} stats={view.stats} />
        </div>
      )}
    </div>
  );
}
