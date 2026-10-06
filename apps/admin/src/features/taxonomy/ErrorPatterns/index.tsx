import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from '@english-saas/ui';
import { Pencil, Plus } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { ErrorPatternSelect } from '../../curriculum/components/ReferenceSelects';
import { DeprecateDialog } from '../components/DeprecateDialog';
import { LoadMore } from '../components/LoadMore';
import { ObsoleteNote } from '../components/ObsoleteNote';
import { ErrorPatternDialog } from './ErrorPatternDialog';
import { useErrorPatternsController } from './useErrorPatternsController';

export function ErrorPatterns() {
  const controller = useErrorPatternsController();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-muted">{t('errors.subtitle')}</p>
        <Button
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          onClick={controller.openCreate}
        >
          {t('errors.new')}
        </Button>
      </div>

      <section
        aria-label={t('taxonomy.filters')}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Input
          label={t('taxonomy.filter.search')}
          placeholder={t('errors.filter.searchPlaceholder')}
          value={controller.q}
          onChange={(event) => controller.setQ(event.target.value)}
        />
        <div className="flex items-end">
          <Checkbox
            label={t('taxonomy.filter.showObsolete')}
            checked={controller.showObsolete}
            onCheckedChange={controller.setShowObsolete}
          />
        </div>
      </section>

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('content.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.patterns.length === 0 ? (
        <EmptyState
          title={t('errors.empty.title')}
          description={
            controller.hasFilters
              ? t('taxonomy.empty.filtered')
              : t('errors.empty.description')
          }
          {...(controller.hasFilters
            ? {
                action: (
                  <Button variant="ghost" onClick={controller.clearFilters}>
                    {t('taxonomy.filter.clear')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <ul aria-label={t('errors.list')} className="space-y-3">
          {controller.patterns.map((pattern) => (
            <li key={pattern.id}>
              <Card className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="font-display text-lg text-ink">
                    {pattern.description}
                  </h2>
                  <p className="font-mono text-xs text-muted">{pattern.id}</p>
                  <p className="text-sm text-ink">
                    <span className="text-error line-through">
                      {pattern.example}
                    </span>
                    {' → '}
                    <span className="text-ok">{pattern.correction}</span>
                  </p>
                  <p className="text-sm text-muted">{pattern.explanation}</p>
                  <p className="text-xs text-muted">
                    {t('errors.skills', { count: pattern.skillIds.length })}
                  </p>
                  <ObsoleteNote
                    deprecatedAt={pattern.deprecatedAt}
                    replacedById={pattern.replacedById}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('errors.edit', { id: pattern.id })}
                    onClick={() => controller.openEdit(pattern)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  {pattern.deprecatedAt === null ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('errors.deprecate', { id: pattern.id })}
                      onClick={() => controller.openDeprecate(pattern)}
                    >
                      {t('taxonomy.deprecate.open')}
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <LoadMore
        hasMore={controller.hasMore}
        isLoading={controller.isLoadingMore}
        onLoad={controller.loadMore}
      />

      <ErrorPatternDialog
        pattern={controller.dialog}
        onClose={controller.closeDialog}
      />

      <DeprecateDialog
        open={controller.deprecating !== null}
        title={t('errors.deprecate.title', {
          id: controller.deprecating?.id ?? '',
        })}
        description={t('errors.deprecate.description')}
        error={controller.deprecateError}
        isLoading={controller.isDeprecating}
        onConfirm={controller.confirmDeprecate}
        onCancel={controller.closeDeprecate}
      >
        <ErrorPatternSelect
          label={t('errors.deprecate.replacement')}
          value={controller.replacement}
          onChange={controller.setReplacement}
          exclude={
            controller.deprecating === null ? [] : [controller.deprecating.id]
          }
        />
        <p className="text-xs text-muted">{t('taxonomy.deprecate.optional')}</p>
      </DeprecateDialog>
    </div>
  );
}
