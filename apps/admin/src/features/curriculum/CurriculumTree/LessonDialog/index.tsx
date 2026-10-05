import { CEFR_LEVELS, type CefrLevel } from '@english-saas/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Select,
  Textarea,
} from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { useLessonDialogController } from './useLessonDialogController';

export type LessonDialogProps = {
  open: boolean;
  unitId: string;
  unitTitle: string;
  order: number;
  defaultLevel: CefrLevel;
  onClose: () => void;
  onCreated: (lessonId: string, versionId: string | null) => void;
};

function LessonForm({
  unitId,
  unitTitle,
  order,
  defaultLevel,
  onClose,
  onCreated,
}: Omit<LessonDialogProps, 'open'>) {
  const controller = useLessonDialogController({
    unitId,
    order,
    defaultLevel,
    onCreated,
  });

  return (
    <form onSubmit={controller.handleSubmit} noValidate className="space-y-4">
      <div>
        <DialogTitle className="font-display text-lg text-ink">
          {t('tree.lessonDialog.title')}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted">
          {t('tree.lessonDialog.description', { unit: unitTitle })}
        </DialogDescription>
      </div>

      <Input
        label={t('tree.lessonDialog.name')}
        value={controller.title}
        onChange={(event) => controller.changeTitle(event.target.value)}
        error={controller.errors.title}
        autoFocus
      />
      <Input
        label={t('content.slug.label')}
        hint={t('content.slug.hint')}
        value={controller.slug}
        onChange={(event) => controller.changeSlug(event.target.value)}
        error={controller.errors.slug}
      />
      <Textarea
        label={t('tree.lessonDialog.objective')}
        value={controller.objective}
        onChange={(event) => controller.setObjective(event.target.value)}
        error={controller.errors.objective}
        rows={3}
      />
      <Select
        label={t('content.level.label')}
        value={controller.cefrLevel}
        onChange={(event) =>
          controller.setCefrLevel(event.target.value as CefrLevel)
        }
        options={CEFR_LEVELS.map((level) => ({ value: level, label: level }))}
        error={controller.errors.cefrLevel}
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
          {t('content.create')}
        </Button>
      </div>
    </form>
  );
}

export function LessonDialog({ open, onClose, ...rest }: LessonDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent>
        {open ? <LessonForm {...rest} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}
