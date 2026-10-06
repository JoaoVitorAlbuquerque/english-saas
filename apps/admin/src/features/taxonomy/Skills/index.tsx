import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
} from '@english-saas/ui';
import {
  CEFR_LEVELS,
  COMPETENCIES,
  COMPETENCY_LABELS,
  SKILL_TYPES,
  SKILL_TYPE_LABELS,
  type CefrLevel,
  type Competency,
  type SkillType,
} from '@english-saas/shared';
import { Pencil, Plus } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { SkillPicker } from '../../curriculum/components/SkillPicker';
import { DeprecateDialog } from '../components/DeprecateDialog';
import { LoadMore } from '../components/LoadMore';
import { ObsoleteNote } from '../components/ObsoleteNote';
import { SkillDialog } from './SkillDialog';
import { useSkillsController } from './useSkillsController';

export function Skills() {
  const controller = useSkillsController();
  const { filters } = controller;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-muted">{t('skills.subtitle')}</p>
        <Button
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          onClick={controller.openCreate}
        >
          {t('skills.new')}
        </Button>
      </div>

      <section
        aria-label={t('taxonomy.filters')}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Input
          label={t('taxonomy.filter.search')}
          placeholder={t('skills.filter.searchPlaceholder')}
          value={filters.q}
          onChange={(event) => controller.setFilter('q', event.target.value)}
        />
        <Select
          label={t('content.level.label')}
          value={filters.level}
          onChange={(event) =>
            controller.setFilter('level', event.target.value as CefrLevel | '')
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...CEFR_LEVELS.map((level) => ({ value: level, label: level })),
          ]}
        />
        <Select
          label={t('skills.competency')}
          value={filters.competency}
          onChange={(event) =>
            controller.setFilter(
              'competency',
              event.target.value as Competency | '',
            )
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...COMPETENCIES.map((entry) => ({
              value: entry,
              label: COMPETENCY_LABELS[entry],
            })),
          ]}
        />
        <Select
          label={t('skills.type')}
          value={filters.type}
          onChange={(event) =>
            controller.setFilter('type', event.target.value as SkillType | '')
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...SKILL_TYPES.map((entry) => ({
              value: entry,
              label: SKILL_TYPE_LABELS[entry],
            })),
          ]}
        />
        <div className="flex items-end">
          <Checkbox
            label={t('taxonomy.filter.showObsolete')}
            checked={filters.showObsolete}
            onCheckedChange={(checked) =>
              controller.setFilter('showObsolete', checked)
            }
          />
        </div>
      </section>

      {controller.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('content.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.skills.length === 0 ? (
        <EmptyState
          title={t('skills.empty.title')}
          description={
            controller.hasFilters
              ? t('taxonomy.empty.filtered')
              : t('skills.empty.description')
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
        <ul aria-label={t('skills.list')} className="space-y-3">
          {controller.skills.map((skill) => (
            <li key={skill.id}>
              <Card className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg text-ink">
                      {skill.title}
                    </h2>
                    <Badge tone="muted">{skill.cefrLevel}</Badge>
                    <Badge tone="accent">{SKILL_TYPE_LABELS[skill.type]}</Badge>
                    <Badge tone="muted">
                      {COMPETENCY_LABELS[skill.competency]}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-muted">{skill.id}</p>
                  {skill.description ? (
                    <p className="text-sm text-ink">{skill.description}</p>
                  ) : null}
                  <p className="text-xs text-muted">
                    {t('skills.links', {
                      prerequisites: skill.prerequisites.length,
                      errors: skill.commonErrors.length,
                    })}
                  </p>
                  <ObsoleteNote
                    deprecatedAt={skill.deprecatedAt}
                    replacedById={skill.replacedById}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('skills.edit', { title: skill.title })}
                    onClick={() => controller.openEdit(skill)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  {skill.deprecatedAt === null ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('skills.deprecate', { title: skill.title })}
                      onClick={() => controller.openDeprecate(skill)}
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

      <SkillDialog skill={controller.dialog} onClose={controller.closeDialog} />

      <DeprecateDialog
        open={controller.deprecating !== null}
        title={t('skills.deprecate.title', {
          title: controller.deprecating?.title ?? '',
        })}
        description={t('skills.deprecate.description')}
        error={controller.deprecateError}
        isLoading={controller.isDeprecating}
        onConfirm={controller.confirmDeprecate}
        onCancel={controller.closeDeprecate}
      >
        <SkillPicker
          label={t('skills.deprecate.replacement')}
          value={controller.replacement}
          onChange={controller.setReplacement}
        />
        <p className="text-xs text-muted">{t('taxonomy.deprecate.optional')}</p>
      </DeprecateDialog>
    </div>
  );
}
