import { BONUS_LIMITS } from '@english-saas/api-client';
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
import { useGrantController } from './useGrantController';

export type GrantDialogProps = {
  open: boolean;
  userId: string;
  studentName: string;
  /** Saldo de hoje, para mostrar o de depois. */
  balance: number | undefined;
  onClose: () => void;
};

/** Conceder créditos: quantidade e motivo (obrigatório) — os dois ficam no extrato e na auditoria. */
export function GrantDialog({
  open,
  userId,
  studentName,
  balance,
  onClose,
}: GrantDialogProps) {
  const controller = useGrantController({ userId, balance, onClose });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          controller.close();
        }
      }}
    >
      <DialogContent>
        <DialogTitle className="font-display text-lg text-ink">
          {t('student.grant.title')} — {studentName}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          {t('student.grant.description')}
        </DialogDescription>

        <form
          noValidate
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            controller.submit();
          }}
        >
          <Input
            label={t('student.grant.amount')}
            inputMode="numeric"
            autoComplete="off"
            value={controller.amount}
            onChange={(event) => controller.setAmount(event.target.value)}
            error={controller.errors.amount}
          />
          <Textarea
            label={t('student.grant.reason')}
            hint={t('student.grant.reasonHint')}
            maxLength={BONUS_LIMITS.reasonMax + 50}
            value={controller.reason}
            onChange={(event) => controller.setReason(event.target.value)}
            error={controller.errors.reason}
          />

          {controller.balanceAfter !== null && balance !== undefined ? (
            <p role="status" className="text-sm text-ink">
              {t('student.grant.preview', {
                from: balance,
                to: controller.balanceAfter,
              })}
            </p>
          ) : null}

          {controller.apiError ? (
            <p role="alert" className="text-sm text-error">
              {t('student.grant.error')}: {controller.apiError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={controller.close}>
              {t('student.grant.cancel')}
            </Button>
            <Button type="submit" isLoading={controller.isSubmitting}>
              {t('student.grant.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
