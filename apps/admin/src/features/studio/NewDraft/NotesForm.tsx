import {
  CEFR_LEVELS,
  DRAFT_LIMITS,
  type CefrLevel,
} from '@english-saas/shared';
import { Button, Input, Select } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { CostEstimate } from './CostEstimate';
import { useNotesDraftForm } from './useNewDraftController';

/** Pedido de notas de registro falado × padrão. */
export function NotesForm() {
  const controller = useNotesDraftForm();
  const { form, errors } = controller;

  return (
    <form
      onSubmit={controller.submit}
      noValidate
      aria-label={t('studio.new.notes.title')}
      className="space-y-5"
    >
      <p className="max-w-2xl text-sm text-muted">
        {t('studio.new.notes.description')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('content.level.label')}
          value={form.level}
          onChange={(event) =>
            controller.setLevel(event.target.value as CefrLevel | '')
          }
          options={[
            { value: '', label: t('studio.new.choose') },
            ...CEFR_LEVELS.map((level) => ({ value: level, label: level })),
          ]}
          error={errors['level']}
        />
        <Input
          label={t('studio.new.notes.count')}
          hint={t('studio.new.notes.countHint', {
            max: DRAFT_LIMITS.noteCount.max,
          })}
          inputMode="numeric"
          value={form.count}
          onChange={(event) => controller.setCount(event.target.value)}
          error={errors['count']}
        />
      </div>

      {controller.serverError ? (
        <p role="alert" className="text-sm text-error">
          {controller.serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <CostEstimate
          estimate={controller.estimate.data}
          isLoading={controller.estimate.isPending}
        />
        <Button type="submit" isLoading={controller.isSubmitting}>
          {t('studio.new.submit')}
        </Button>
      </div>
    </form>
  );
}
