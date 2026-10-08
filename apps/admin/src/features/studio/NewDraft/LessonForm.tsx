import {
  CEFR_LEVELS,
  DRAFT_LIMITS,
  type CefrLevel,
} from '@english-saas/shared';
import { Button, Chip, Input, Select, Textarea } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { SkillMultiPicker } from '../../curriculum/components/SkillPicker';
import { CostEstimate } from './CostEstimate';
import { useLessonDraftForm } from './useNewDraftController';

/** Pedido de uma lição inteira: nível, unidade, objetivo, skills e personagens. */
export function LessonForm() {
  const controller = useLessonDraftForm();
  const { form, errors } = controller;

  return (
    <form
      onSubmit={controller.submit}
      noValidate
      aria-label={t('studio.new.lesson.title')}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('content.level.label')}
          value={form.level}
          onChange={(event) =>
            controller.changeLevel(event.target.value as CefrLevel | '')
          }
          options={[
            { value: '', label: t('studio.new.choose') },
            ...CEFR_LEVELS.map((level) => ({ value: level, label: level })),
          ]}
          error={errors['level']}
        />
        <Select
          label={t('studio.new.lesson.unit')}
          value={form.unitId}
          disabled={form.level === ''}
          onChange={(event) => controller.changeUnit(event.target.value)}
          options={[
            {
              value: '',
              label:
                form.level === ''
                  ? t('studio.new.lesson.unitFirstLevel')
                  : controller.isLoadingUnits
                    ? t('studio.new.loading')
                    : t('studio.new.choose'),
            },
            ...controller.units.map((unit) => ({
              value: unit.id,
              label: unit.title,
            })),
          ]}
          error={errors['unitId']}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">
          {t('studio.new.lesson.where')}
        </legend>
        <div className="flex flex-wrap gap-2">
          <Chip
            selected={form.mode === 'new'}
            onClick={() => controller.setMode('new')}
          >
            {t('studio.new.lesson.modeNew')}
          </Chip>
          <Chip
            selected={form.mode === 'existing'}
            onClick={() => controller.setMode('existing')}
          >
            {t('studio.new.lesson.modeExisting')}
          </Chip>
        </div>

        {form.mode === 'new' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label={t('studio.new.lesson.titleField')}
              hint={t('studio.new.lesson.titleHint')}
              value={form.title}
              onChange={(event) => controller.setTitle(event.target.value)}
              error={errors['title']}
            />
            <Input
              label={t('studio.new.lesson.slug')}
              hint={t('studio.new.lesson.slugHint')}
              value={form.slug}
              onChange={(event) => controller.setSlug(event.target.value)}
              error={errors['slug']}
            />
            <Input
              label={t('studio.new.lesson.order')}
              inputMode="numeric"
              value={form.order}
              onChange={(event) => controller.setOrder(event.target.value)}
              error={errors['order']}
            />
          </div>
        ) : (
          <Select
            label={t('studio.new.lesson.existing')}
            value={form.lessonId}
            disabled={form.unitId === ''}
            onChange={(event) => controller.setLesson(event.target.value)}
            options={[
              {
                value: '',
                label:
                  form.unitId === ''
                    ? t('studio.new.lesson.unitFirst')
                    : t('studio.new.choose'),
              },
              ...controller.lessons.map((lesson) => ({
                value: lesson.id,
                label: `${lesson.slug} — ${lesson.versions[0]?.title ?? ''}`,
              })),
            ]}
            error={errors['lessonId']}
          />
        )}
        {form.mode === 'existing' ? (
          <p className="text-xs text-muted">
            {t('studio.new.lesson.existingHint')}
          </p>
        ) : null}
      </fieldset>

      <Textarea
        label={t('studio.new.lesson.objective')}
        hint={t('studio.new.lesson.objectiveHint', {
          min: DRAFT_LIMITS.objective.min,
          max: DRAFT_LIMITS.objective.max,
        })}
        rows={3}
        value={form.objective}
        onChange={(event) => controller.setObjective(event.target.value)}
        error={errors['objective']}
      />

      <SkillMultiPicker
        label={t('studio.new.lesson.skills')}
        hint={t('studio.new.lesson.skillsHint', {
          max: DRAFT_LIMITS.targetSkills.max,
        })}
        value={form.targetSkillIds}
        max={DRAFT_LIMITS.targetSkills.max}
        onChange={controller.setSkills}
        error={errors['targetSkillIds']}
      />

      <div
        role="group"
        aria-labelledby="draft-characters"
        className="space-y-2"
      >
        <p id="draft-characters" className="text-sm font-medium text-ink">
          {t('studio.new.lesson.characters')}
        </p>
        <p className="text-xs text-muted">
          {t('studio.new.lesson.charactersHint', {
            max: DRAFT_LIMITS.characters.max,
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          {controller.characters.map((character) => (
            <Chip
              key={character.id}
              selected={form.characterIds.includes(character.id)}
              onClick={() => controller.toggleCharacter(character.id)}
            >
              {character.name}
              {controller.unitCast.includes(character.id)
                ? ` · ${t('studio.new.lesson.inCast')}`
                : ''}
            </Chip>
          ))}
        </div>
        {errors['characterIds'] ? (
          <p className="text-sm text-error">{errors['characterIds']}</p>
        ) : null}
      </div>

      <Textarea
        label={t('studio.new.lesson.context')}
        hint={t('studio.new.lesson.contextHint')}
        rows={3}
        value={form.unitContext}
        onChange={(event) => controller.setContext(event.target.value)}
        error={errors['unitContext']}
      />

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
