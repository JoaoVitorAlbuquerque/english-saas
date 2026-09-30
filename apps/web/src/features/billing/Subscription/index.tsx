import type { CreditLedgerEntry } from '@english-saas/api-client';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorState,
  Skeleton,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useSubscriptionController } from './useSubscriptionController';

const ENTRY_LABELS: Record<CreditLedgerEntry['kind'], string> = {
  GRANT: 'Crédito do ciclo',
  CONSUME: 'Uso',
  REFUND: 'Estorno',
  BONUS: 'Bônus',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function Subscription() {
  const {
    isLoading,
    isError,
    retry,
    overview,
    credits,
    history,
    goToPlans,
    isCancelDialogOpen,
    openCancelDialog,
    closeCancelDialog,
    confirmCancel,
    isCanceling,
    cancelError,
  } = useSubscriptionController();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError || overview === undefined) {
    return <ErrorState title={t('subscription.errorTitle')} onRetry={retry} />;
  }

  const canCancel =
    overview.subscription !== null &&
    ['PENDING', 'ACTIVE', 'PAST_DUE'].includes(overview.subscription.status);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-xl text-ink">
        {t('subscription.title')}
      </h1>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg text-ink">{overview.tier}</span>
          {overview.subscription ? (
            <Badge tone="muted">{overview.subscription.status}</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted">{overview.message}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={goToPlans}>
            {overview.tier === 'PLUS'
              ? t('subscription.viewPlans')
              : t('subscription.upgrade')}
          </Button>
          {canCancel ? (
            <Button variant="danger" onClick={openCancelDialog}>
              {t('subscription.cancel')}
            </Button>
          ) : null}
        </div>
      </Card>

      {credits ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink">
              {t('subscription.creditsTitle')}
            </h2>
            <span className="font-display text-lg text-ink">
              {credits.balance}
            </span>
          </div>
          <p className="text-xs text-muted">
            {t('subscription.creditsMonthly')} {credits.monthlyAiCredits}
          </p>

          {history.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-ink">{ENTRY_LABELS[entry.kind]}</span>
                    <span className="text-xs text-muted">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  <span
                    className={entry.amount >= 0 ? 'text-ok' : 'text-muted'}
                  >
                    {entry.amount >= 0 ? '+' : ''}
                    {entry.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {t('subscription.creditsHistoryEmpty')}
            </p>
          )}
        </Card>
      ) : null}

      <Dialog
        open={isCancelDialogOpen}
        onOpenChange={(next) => !next && closeCancelDialog()}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg text-ink">
            {t('subscription.cancelConfirm.title')}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted">
            {overview.subscription?.accessUntil
              ? `${t('subscription.cancelConfirm.descriptionPrefix')} ${formatDate(overview.subscription.accessUntil)}.`
              : t('subscription.cancelConfirm.descriptionNoAccess')}
          </DialogDescription>
          {cancelError ? (
            <p role="alert" className="mt-2 text-sm text-error">
              {cancelError.message}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={closeCancelDialog}>
              {t('subscription.cancelConfirm.stay')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmCancel}
              disabled={isCanceling}
              isLoading={isCanceling}
            >
              {t('subscription.cancelConfirm.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
