import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@english-saas/ui';
import type { ReactNode } from 'react';

import { t } from '../../../messages/pt-BR';

export type DeprecateDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** O seletor da substituta (opcional) — cada tela traz o seu. */
  children: ReactNode;
  error?: string | null;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * "Marcar como obsoleta". O identificador nunca muda (ele vive dentro de
 * lição publicada e do modelo do aluno): tirar de circulação é marcar a data
 * e, se houver, apontar quem substitui.
 */
export function DeprecateDialog({
  open,
  title,
  description,
  children,
  error,
  isLoading = false,
  onConfirm,
  onCancel,
}: DeprecateDialogProps) {
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
        <div className="mt-4 space-y-3">{children}</div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t('content.cancel')}
          </Button>
          <Button variant="danger" isLoading={isLoading} onClick={onConfirm}>
            {t('taxonomy.deprecate.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
