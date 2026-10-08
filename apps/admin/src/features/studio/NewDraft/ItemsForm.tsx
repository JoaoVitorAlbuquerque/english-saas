import {
  CEFR_LEVELS,
  DRAFTABLE_ITEM_TYPES,
  DRAFT_LIMITS,
  ITEM_TYPE_LABELS,
  type CefrLevel,
} from '@english-saas/shared';
import { Button, Chip, Input, Select } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { SkillPicker } from '../../curriculum/components/SkillPicker';
import { CostEstimate } from './CostEstimate';
import { useItemsDraftForm } from './useNewDraftController';

/** Pedido de questões avulsas para uma skill. */
export function ItemsForm() {
  const controller = useItemsDraftForm();
  const { form, errors } = controller;

  return (
    <form
      onSubmit={controller.submit}
      noValidate
      aria-label={t('studio.new.items.title')}
      className="space-y-5"
    >
      <SkillPicker
        label={t('studio.new.items.skill')}
        value={form.skillId === '' ? null : form.skillId}
        onChange={controller.setSkill}
        error={errors['skillId']}
      />

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
          label={t('studio.new.items.count')}
          hint={t('studio.new.items.countHint', {
            max: DRAFT_LIMITS.itemCount.max,
          })}
          inputMode="numeric"
          value={form.count}
          onChange={(event) => controller.setCount(event.target.value)}
          error={errors['count']}
        />
      </div>

      <div role="group" aria-labelledby="draft-types" className="space-y-2">
        <p id="draft-types" className="text-sm font-medium text-ink">
          {t('studio.new.items.types')}
        </p>
        <div className="flex flex-wrap gap-2">
          {DRAFTABLE_ITEM_TYPES.map((type) => (
            <Chip
              key={type}
              selected={form.types.includes(type)}
              onClick={() => controller.toggleType(type)}
            >
              {ITEM_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
        {errors['types'] ? (
          <p className="text-sm text-error">{errors['types']}</p>
        ) : null}
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
