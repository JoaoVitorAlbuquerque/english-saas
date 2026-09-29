import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

export type RebuildConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isRebuilding: boolean;
};

export function RebuildConfirmDialog({
  open,
  onClose,
  onConfirm,
  isRebuilding,
}: RebuildConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {t('today.rebuildConfirm.title')}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          {t('today.rebuildConfirm.description')}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('today.rebuildConfirm.cancel')}
          </Button>
          <Button onClick={onConfirm} isLoading={isRebuilding}>
            {t('today.rebuildConfirm.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
