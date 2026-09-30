import { CEFR_LEVELS, CEFR_LEVEL_LABELS } from '@english-saas/shared';
import {
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { UnitCard } from './UnitCard';
import { useCatalogController } from './useCatalogController';

export function Catalog() {
  const {
    selectedLevel,
    onSelectLevel,
    search,
    onSearchChange,
    isLoading,
    isError,
    retry,
    groups,
    hasAnyUnit,
    openUnit,
  } = useCatalogController();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl text-ink">{t('catalog.title')}</h1>

      <Input
        placeholder={t('catalog.searchPlaceholder')}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        aria-label={t('catalog.searchPlaceholder')}
      />

      <div className="flex flex-wrap gap-2">
        <Chip
          selected={selectedLevel === undefined}
          onClick={() => onSelectLevel(undefined)}
        >
          {t('catalog.allLevels')}
        </Chip>
        {CEFR_LEVELS.map((level) => (
          <Chip
            key={level}
            selected={selectedLevel === level}
            onClick={() => onSelectLevel(level)}
          >
            {level} · {CEFR_LEVEL_LABELS[level]}
          </Chip>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-56" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title={t('catalog.errorTitle')} onRetry={retry} />
      ) : !hasAnyUnit ? (
        <EmptyState
          title={t('catalog.emptyTitle')}
          description={t('catalog.emptyDescription')}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t('catalog.noMatchTitle')}
          description={t('catalog.noMatchDescription')}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.level} className="flex flex-col gap-3">
              <h2 className="font-display text-sm text-muted">
                {group.level} · {CEFR_LEVEL_LABELS[group.level]}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {group.units.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unit={unit}
                    onOpen={() => openUnit(unit.slug)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
