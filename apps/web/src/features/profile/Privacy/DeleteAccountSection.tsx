import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import type { usePrivacyController } from './usePrivacyController';

type Deletion = ReturnType<typeof usePrivacyController>['deletion'];

export function DeleteAccountSection({ deletion }: { deletion: Deletion }) {
  const {
    days,
    isOpen,
    open,
    close,
    confirmWord,
    confirmText,
    setConfirmText,
    canConfirm,
    isDeleting,
    error,
    confirm,
  } = deletion;

  return (
    <Card className="flex flex-col gap-3 border-error/30">
      <div>
        <h2 className="text-sm font-medium text-ink">
          {t('profile.delete.title')}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t('profile.delete.description', { days })}
        </p>
      </div>
      <Button variant="danger" className="self-start" onClick={open}>
        {t('profile.delete.open')}
      </Button>

      <Dialog open={isOpen} onOpenChange={(next) => !next && close()}>
        <DialogContent>
          <DialogTitle className="font-display text-lg text-ink">
            {t('profile.delete.dialogTitle')}
          </DialogTitle>
          <DialogDescription asChild>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
              <li>{t('profile.delete.pointNow')}</li>
              <li>{t('profile.delete.pointAnonymize', { days })}</li>
              <li>{t('profile.delete.pointSubscription')}</li>
              <li>{t('profile.delete.pointExport')}</li>
            </ul>
          </DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canConfirm) {
                confirm();
              }
            }}
            noValidate
          >
            <Input
              label={t('profile.delete.confirmLabel', { word: confirmWord })}
              autoComplete="off"
              autoCapitalize="characters"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
            />

            {error ? (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={isDeleting}>
                {t('profile.delete.keep')}
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={!canConfirm}
                isLoading={isDeleting}
              >
                {t('profile.delete.confirm')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
