import type { AdminRegisterNote } from '@english-saas/api-client';
import {
  AudioButton,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Select,
  Textarea,
} from '@english-saas/ui';
import {
  CEFR_LEVELS,
  REGISTER_LEVELS,
  REGISTER_LEVEL_LABELS,
  type CefrLevel,
  type RegisterLevel,
} from '@english-saas/shared';

import { t } from '../../../../messages/pt-BR';
import { SkillPicker } from '../../../curriculum/components/SkillPicker';
import { useRegisterNoteDialogController } from './useRegisterNoteDialogController';

export type RegisterNoteDialogProps = {
  /** `undefined` fecha; `null` abre para criar; uma nota, para editar. */
  note: AdminRegisterNote | null | undefined;
  onClose: () => void;
};

function RegisterNoteForm({
  note,
  onClose,
}: {
  note: AdminRegisterNote | null;
  onClose: () => void;
}) {
  const controller = useRegisterNoteDialogController({
    note,
    onSaved: onClose,
  });

  return (
    <form onSubmit={controller.handleSubmit} noValidate className="space-y-4">
      <DialogTitle className="font-display text-lg text-ink">
        {note === null
          ? t('notes.dialog.createTitle')
          : t('notes.dialog.editTitle', { form: note.spokenForm })}
      </DialogTitle>

      <Input
        label={t('notes.dialog.id')}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={t('notes.dialog.spoken')}
          hint={t('notes.dialog.spokenHint')}
          value={controller.spokenForm}
          onChange={(event) => controller.setSpokenForm(event.target.value)}
          error={controller.errors.spokenForm}
          autoFocus={controller.isEditing}
        />
        <Input
          label={t('notes.dialog.standard')}
          hint={t('notes.dialog.standardHint')}
          value={controller.standardForm}
          onChange={(event) => controller.setStandardForm(event.target.value)}
          error={controller.errors.standardForm}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t('notes.register')}
          value={controller.register}
          onChange={(event) =>
            controller.setRegister(event.target.value as RegisterLevel)
          }
          options={REGISTER_LEVELS.map((entry) => ({
            value: entry,
            label: REGISTER_LEVEL_LABELS[entry],
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
        label={t('notes.dialog.explanation')}
        hint={t('notes.dialog.explanationHint')}
        value={controller.explanation}
        onChange={(event) => controller.setExplanation(event.target.value)}
        error={controller.errors.explanation}
        rows={3}
      />
      <Input
        label={t('notes.dialog.whenToAvoid')}
        hint={t('notes.dialog.whenToAvoidHint')}
        value={controller.whenToAvoid}
        onChange={(event) => controller.setWhenToAvoid(event.target.value)}
        error={controller.errors.whenToAvoid}
      />

      <SkillPicker
        label={t('notes.dialog.skill')}
        value={controller.skillId}
        onChange={controller.setSkillId}
        error={controller.errors.skillId}
        type="REGISTER"
        fieldPath="skillId"
      />
      <p className="-mt-2 text-xs text-muted">{t('notes.dialog.skillHint')}</p>

      <section className="space-y-1 rounded-lg bg-ground px-3 py-2">
        <h3 className="text-sm font-medium text-ink">
          {t('notes.dialog.audio')}
        </h3>
        {note?.audio ? (
          <div className="flex items-center gap-3">
            <AudioButton
              src={note.audio.url}
              label={t('notes.listen', { form: note.spokenForm })}
              className="size-8"
            />
            <span className="text-xs text-muted">{t('notes.hasAudio')}</span>
          </div>
        ) : (
          <p className="text-xs text-muted">{t('notes.dialog.noAudio')}</p>
        )}
      </section>

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

export function RegisterNoteDialog({ note, onClose }: RegisterNoteDialogProps) {
  return (
    <Dialog
      open={note !== undefined}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {note !== undefined ? (
          <RegisterNoteForm note={note} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
