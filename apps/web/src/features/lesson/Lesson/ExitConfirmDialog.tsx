import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

export type ExitConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ExitConfirmDialog({
  open,
  onClose,
  onConfirm,
}: ExitConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {t('lesson.exit.title')}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          {t('lesson.exit.description')}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('lesson.exit.stay')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('lesson.exit.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
