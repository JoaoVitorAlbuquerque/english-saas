import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Ação que não se desfaz com um clique (arquivar) usa o botão vermelho. */
  danger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação antes de publicar ou arquivar. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          {description}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t('content.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
