import {
  AudioButton,
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
  REGISTER_LEVELS,
  REGISTER_LEVEL_LABELS,
  type CefrLevel,
  type RegisterLevel,
} from '@english-saas/shared';
import { Pencil, Plus } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { RegisterNoteSelect } from '../../curriculum/components/ReferenceSelects';
import { DeprecateDialog } from '../components/DeprecateDialog';
import { LoadMore } from '../components/LoadMore';
import { ObsoleteNote } from '../components/ObsoleteNote';
import { RegisterNoteDialog } from './RegisterNoteDialog';
import { useRegisterNotesController } from './useRegisterNotesController';

export function RegisterNotes() {
  const controller = useRegisterNotesController();
  const { filters } = controller;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-muted">{t('notes.subtitle')}</p>
        <Button
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
          onClick={controller.openCreate}
        >
          {t('notes.new')}
        </Button>
      </div>

      <section
        aria-label={t('taxonomy.filters')}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          label={t('taxonomy.filter.search')}
          placeholder={t('notes.filter.searchPlaceholder')}
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
          label={t('notes.register')}
          value={filters.register}
          onChange={(event) =>
            controller.setFilter(
              'register',
              event.target.value as RegisterLevel | '',
            )
          }
          options={[
            { value: '', label: t('taxonomy.filter.any') },
            ...REGISTER_LEVELS.map((entry) => ({
              value: entry,
              label: REGISTER_LEVEL_LABELS[entry],
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
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : controller.error ? (
        <ErrorState
          title={t('content.loadError')}
          description={controller.error.message}
          onRetry={controller.retry}
        />
      ) : controller.notes.length === 0 ? (
        <EmptyState
          title={t('notes.empty.title')}
          description={
            controller.hasFilters
              ? t('taxonomy.empty.filtered')
              : t('notes.empty.description')
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
        <ul aria-label={t('notes.list')} className="space-y-3">
          {controller.notes.map((note) => (
            <li key={note.id}>
              <Card className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg text-ink">
                      {note.spokenForm}
                      <span className="mx-2 text-muted">×</span>
                      {note.standardForm}
                    </h2>
                    <Badge tone="muted">{note.cefrLevel}</Badge>
                    <Badge tone="accent">
                      {REGISTER_LEVEL_LABELS[note.register]}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-muted">{note.id}</p>
                  <p className="text-sm text-ink">{note.explanation}</p>
                  {note.whenToAvoid ? (
                    <p className="text-sm text-muted">
                      {t('notes.whenToAvoid', { text: note.whenToAvoid })}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {note.audio ? (
                      <span className="inline-flex items-center gap-2 text-xs text-muted">
                        <AudioButton
                          src={note.audio.url}
                          label={t('notes.listen', { form: note.spokenForm })}
                          className="size-8"
                        />
                        {t('notes.hasAudio')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">
                        {t('notes.noAudio')}
                      </span>
                    )}
                    {note.skillId ? (
                      <span className="text-xs text-muted">
                        {t('notes.skill')}{' '}
                        <span className="font-mono">{note.skillId}</span>
                      </span>
                    ) : null}
                  </div>
                  <ObsoleteNote
                    deprecatedAt={note.deprecatedAt}
                    replacedById={note.replacedById}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('notes.edit', { form: note.spokenForm })}
                    onClick={() => controller.openEdit(note)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  {note.deprecatedAt === null ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('notes.deprecate', {
                        form: note.spokenForm,
                      })}
                      onClick={() => controller.openDeprecate(note)}
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

      <RegisterNoteDialog
        note={controller.dialog}
        onClose={controller.closeDialog}
      />

      <DeprecateDialog
        open={controller.deprecating !== null}
        title={t('notes.deprecate.title', {
          form: controller.deprecating?.spokenForm ?? '',
        })}
        description={t('notes.deprecate.description')}
        error={controller.deprecateError}
        isLoading={controller.isDeprecating}
        onConfirm={controller.confirmDeprecate}
        onCancel={controller.closeDeprecate}
      >
        <RegisterNoteSelect
          label={t('notes.deprecate.replacement')}
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
