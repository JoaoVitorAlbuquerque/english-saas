import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@english-saas/ui';
import type { ReactNode } from 'react';

import { t } from '../../../messages/pt-BR';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Padrão: "Cancelar". */
  cancelLabel?: string;
  /** Ação que não se desfaz fica vermelha. */
  danger?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirmação simples de duas saídas — o que muda nas telas de perfil. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  isLoading = false,
  error = null,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          {description}
        </DialogDescription>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelLabel ?? t('profile.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
