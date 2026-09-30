import { CEFR_LEVELS } from '@english-saas/shared';
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LINK_BUTTON_CLASS } from '../components/link-button';
import { formatInTimeZone } from '../lib/format-date';
import type { LevelEvolution } from '../lib/level-evolution';
import { useMaterialsController } from './useMaterialsController';

export function Materials() {
  const {
    isLoading,
    isError,
    retry,
    materials,
    evolution,
    timeZone,
    hasMore,
    loadMore,
    isLoadingMore,
  } = useMaterialsController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('materials.errorTitle')} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl text-ink">
          {t('materials.title')}
        </h1>
        <Link
          to="/ferramentas"
          className="text-sm font-medium text-accent underline"
        >
          {t('materials.new')}
        </Link>
      </div>

      {materials.length === 0 ? (
        <EmptyState
          title={t('materials.empty.title')}
          description={t('materials.empty.description')}
          action={
            <Link to="/ferramentas" className={LINK_BUTTON_CLASS}>
              {t('materials.new')}
            </Link>
          }
        />
      ) : (
        <>
          {evolution.points.length > 1 ? (
            <EvolutionCard evolution={evolution} timeZone={timeZone} />
          ) : null}

          <ul className="flex flex-col gap-3">
            {materials.map((material) => (
              <li key={material.id}>
                <Link to={`/materiais/${material.id}`} className="block">
                  <Card className="flex flex-col gap-1 hover:bg-ground">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-ink">
                        {material.title}
                      </span>
                      <Badge tone="accent">{material.level}</Badge>
                    </div>
                    <span className="text-sm text-muted">
                      {material.topic} ·{' '}
                      {formatInTimeZone(material.createdAt, timeZone)} ·{' '}
                      {t('materials.exercises', {
                        count: material.exerciseCount,
                      })}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <Button
              variant="ghost"
              className="self-center"
              isLoading={isLoadingMore}
              onClick={loadMore}
            >
              {t('materials.loadMore')}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Uma coluna por material, do mais antigo ao mais novo, na altura do nível
 * (A1 embaixo, C1 em cima) — sem biblioteca de gráfico.
 */
function EvolutionCard({
  evolution,
  timeZone,
}: {
  evolution: LevelEvolution;
  timeZone: string | undefined;
}) {
  const summary =
    evolution.steps > 1
      ? t('materials.evolutionUpMany', { steps: evolution.steps })
      : evolution.steps === 1
        ? t('materials.evolutionUp', { steps: evolution.steps })
        : evolution.steps === 0
          ? t('materials.evolutionSame')
          : t('materials.evolutionDown');

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg text-ink">
        {t('materials.evolutionTitle')}
      </h2>
      <p className="text-sm text-muted">{summary}</p>
      <div
        role="img"
        aria-label={`${evolution.first ?? ''} → ${evolution.latest ?? ''}`}
        className="flex h-28 items-end gap-1 overflow-x-auto"
      >
        {evolution.points.map((point) => {
          const rank = CEFR_LEVELS.indexOf(point.level) + 1;
          return (
            <div
              key={point.id}
              title={`${point.level} · ${formatInTimeZone(point.createdAt, timeZone)}`}
              className="flex h-full min-w-6 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="font-mono text-[10px] text-muted">
                {point.level}
              </span>
              <span
                className={cn(
                  'w-full max-w-8 rounded-t-md bg-accent/70',
                  point.id === evolution.points.at(-1)?.id && 'bg-accent',
                )}
                style={{
                  height: `${String((rank / CEFR_LEVELS.length) * 100)}%`,
                }}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
