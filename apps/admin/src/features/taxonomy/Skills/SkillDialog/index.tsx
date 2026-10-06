import type { AdminSkill } from '@english-saas/api-client';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Select,
  Textarea,
} from '@english-saas/ui';
import {
  CEFR_LEVELS,
  COMPETENCIES,
  COMPETENCY_LABELS,
  LEARNING_GOALS,
  LEARNING_GOAL_LABELS,
  SKILL_TYPES,
  SKILL_TYPE_LABELS,
  type CefrLevel,
  type Competency,
  type SkillType,
} from '@english-saas/shared';

import { t } from '../../../../messages/pt-BR';
import { SkillMultiPicker } from '../../../curriculum/components/SkillPicker';
import { ErrorPatternChips } from '../../components/ErrorPatternChips';
import { useSkillDialogController } from './useSkillDialogController';

export type SkillDialogProps = {
  /** `undefined` fecha; `null` abre para criar; uma skill, para editar. */
  skill: AdminSkill | null | undefined;
  onClose: () => void;
};

function SkillForm({
  skill,
  onClose,
}: {
  skill: AdminSkill | null;
  onClose: () => void;
}) {
  const controller = useSkillDialogController({ skill, onSaved: onClose });

  return (
    <form onSubmit={controller.handleSubmit} noValidate className="space-y-4">
      <DialogTitle className="font-display text-lg text-ink">
        {skill === null
          ? t('skills.dialog.createTitle')
          : t('skills.dialog.editTitle', { title: skill.title })}
      </DialogTitle>

      <Input
        label={t('skills.dialog.id')}
        hint={
          controller.isEditing
            ? t('taxonomy.slugLocked')
            : t('taxonomy.slugHint')
        }
        value={controller.id}
        onChange={(event) => controller.setId(event.target.value)}
        error={controller.errors.id}
        disabled={controller.isEditing}
        autoFocus={!controller.isEditing}
      />
      <Input
        label={t('skills.dialog.title')}
        value={controller.title}
        onChange={(event) => controller.setTitle(event.target.value)}
        error={controller.errors.title}
        autoFocus={controller.isEditing}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label={t('skills.type')}
          value={controller.type}
          onChange={(event) =>
            controller.setType(event.target.value as SkillType)
          }
          options={SKILL_TYPES.map((entry) => ({
            value: entry,
            label: SKILL_TYPE_LABELS[entry],
          }))}
        />
        <Select
          label={t('skills.competency')}
          value={controller.competency}
          onChange={(event) =>
            controller.setCompetency(event.target.value as Competency)
          }
          options={COMPETENCIES.map((entry) => ({
            value: entry,
            label: COMPETENCY_LABELS[entry],
          }))}
        />
        <Select
          label={t('content.level.label')}
          value={controller.cefrLevel}
          onChange={(event) =>
            controller.setCefrLevel(event.target.value as CefrLevel)
          }
          options={CEFR_LEVELS.map((level) => ({ value: level, label: level }))}
        />
      </div>

      <Textarea
        label={t('skills.dialog.description')}
        value={controller.description}
        onChange={(event) => controller.setDescription(event.target.value)}
        error={controller.errors.description}
        rows={3}
      />

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-ink">
          {t('skills.dialog.goals')}
        </legend>
        <p className="text-xs text-muted">{t('skills.dialog.goalsHint')}</p>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {LEARNING_GOALS.map((goal) => (
            <Checkbox
              key={goal}
              label={LEARNING_GOAL_LABELS[goal]}
              checked={controller.goals.includes(goal)}
              onCheckedChange={(checked) =>
                controller.toggleGoal(goal, checked)
              }
            />
          ))}
        </div>
      </fieldset>

      <SkillMultiPicker
        label={t('skills.dialog.prerequisites')}
        hint={t('skills.dialog.prerequisitesHint')}
        value={controller.prerequisites}
        onChange={controller.setPrerequisites}
        error={controller.errors.prerequisites}
        max={20}
        exclude={skill === null ? [] : [skill.id]}
        fieldPath="prerequisites"
      />

      <ErrorPatternChips
        label={t('skills.dialog.commonErrors')}
        hint={t('skills.dialog.commonErrorsHint')}
        value={controller.commonErrors}
        onChange={controller.setCommonErrors}
        error={controller.errors.commonErrors}
        fieldPath="commonErrors"
      />

      {controller.formError ? (
        <p role="alert" className="text-sm text-error">
          {controller.formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('content.cancel')}
        </Button>
        <Button type="submit" isLoading={controller.isSubmitting}>
          {t('content.save')}
        </Button>
      </div>
    </form>
  );
}

export function SkillDialog({ skill, onClose }: SkillDialogProps) {
  return (
    <Dialog
      open={skill !== undefined}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {skill !== undefined ? (
          <SkillForm skill={skill} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
