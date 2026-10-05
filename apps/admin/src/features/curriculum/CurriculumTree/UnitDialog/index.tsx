import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Textarea,
} from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { useUnitDialogController } from './useUnitDialogController';

export type UnitDialogProps = {
  open: boolean;
  levelId: string;
  levelLabel: string;
  order: number;
  onClose: () => void;
};

/** O corpo só monta com o diálogo aberto: cada abertura começa do zero. */
function UnitForm({
  levelId,
  levelLabel,
  order,
  onClose,
}: Omit<UnitDialogProps, 'open'>) {
  const controller = useUnitDialogController({
    levelId,
    order,
    onCreated: onClose,
  });

  return (
    <form onSubmit={controller.handleSubmit} noValidate className="space-y-4">
      <div>
        <DialogTitle className="font-display text-lg text-ink">
          {t('tree.unitDialog.title')}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted">
          {t('tree.unitDialog.description', { level: levelLabel })}
        </DialogDescription>
      </div>

      <Input
        label={t('tree.unitDialog.name')}
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
        label={t('tree.unitDialog.synopsis')}
        value={controller.synopsis}
        onChange={(event) => controller.setSynopsis(event.target.value)}
        rows={3}
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

export function UnitDialog({ open, onClose, ...rest }: UnitDialogProps) {
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
        {open ? <UnitForm {...rest} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}
