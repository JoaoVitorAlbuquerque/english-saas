import type { AdminErrorPattern } from '@english-saas/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Textarea,
} from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { SkillMultiPicker } from '../../../curriculum/components/SkillPicker';
import { useErrorPatternDialogController } from './useErrorPatternDialogController';

export type ErrorPatternDialogProps = {
  /** `undefined` fecha; `null` abre para criar; um erro típico, para editar. */
  pattern: AdminErrorPattern | null | undefined;
  onClose: () => void;
};

function ErrorPatternForm({
  pattern,
  onClose,
}: {
  pattern: AdminErrorPattern | null;
  onClose: () => void;
}) {
  const controller = useErrorPatternDialogController({
    pattern,
    onSaved: onClose,
  });

  return (
    <form onSubmit={controller.handleSubmit} noValidate className="space-y-4">
      <DialogTitle className="font-display text-lg text-ink">
        {pattern === null
          ? t('errors.dialog.createTitle')
          : t('errors.dialog.editTitle', { id: pattern.id })}
      </DialogTitle>

      <Input
        label={t('errors.dialog.id')}
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
      <Textarea
        label={t('errors.dialog.description')}
        hint={t('errors.dialog.descriptionHint')}
        value={controller.description}
        onChange={(event) => controller.setDescription(event.target.value)}
        error={controller.errors.description}
        rows={2}
        autoFocus={controller.isEditing}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={t('errors.dialog.example')}
          hint={t('errors.dialog.exampleHint')}
          value={controller.example}
          onChange={(event) => controller.setExample(event.target.value)}
          error={controller.errors.example}
        />
        <Input
          label={t('errors.dialog.correction')}
          value={controller.correction}
          onChange={(event) => controller.setCorrection(event.target.value)}
          error={controller.errors.correction}
        />
      </div>
      <Textarea
        label={t('errors.dialog.explanation')}
        hint={t('errors.dialog.explanationHint')}
        value={controller.explanation}
        onChange={(event) => controller.setExplanation(event.target.value)}
        error={controller.errors.explanation}
        rows={3}
      />

      <SkillMultiPicker
        label={t('errors.dialog.skills')}
        hint={t('errors.dialog.skillsHint')}
        value={controller.skillIds}
        onChange={controller.setSkillIds}
        error={controller.errors.skillIds}
        max={20}
        fieldPath="skillIds"
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

export function ErrorPatternDialog({
  pattern,
  onClose,
}: ErrorPatternDialogProps) {
  return (
    <Dialog
      open={pattern !== undefined}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {pattern !== undefined ? (
          <ErrorPatternForm pattern={pattern} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
