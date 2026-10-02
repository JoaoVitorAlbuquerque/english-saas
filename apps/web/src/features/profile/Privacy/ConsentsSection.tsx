import { Button, Card, Checkbox, ErrorState, Skeleton } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { usePrivacyController } from './usePrivacyController';

type Consents = ReturnType<typeof usePrivacyController>['consents'];

export function ConsentsSection({ consents }: { consents: Consents }) {
  const {
    isLoading,
    isError,
    retry,
    rows,
    isSaving,
    setConsent,
    acceptNewVersion,
    isRevokeOpen,
    closeRevoke,
    confirmRevoke,
  } = consents;

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-ink">
          {t('profile.privacy.consentsTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t('profile.privacy.consentsDescription')}
        </p>
      </div>

      {isLoading ? <Skeleton className="h-32" /> : null}
      {isError ? (
        <ErrorState
          title={t('profile.privacy.consentsErrorTitle')}
          onRetry={retry}
        />
      ) : null}

      {rows.map((row) => (
        <div key={row.type} className="flex flex-col gap-1">
          {row.required ? (
            <p className="text-base text-ink">{row.label}</p>
          ) : (
            <Checkbox
              label={row.label}
              checked={row.granted}
              disabled={isSaving}
              onCheckedChange={(checked) => setConsent(row.type, checked)}
            />
          )}
          <p className="text-sm text-muted">{row.status}</p>
          {row.required ? (
            <p className="text-sm text-muted">
              {t('profile.privacy.consentRequired')}
            </p>
          ) : null}
          {row.outdated ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="status" className="text-sm text-error">
                {t('profile.privacy.consentOutdated')}
              </p>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSaving}
                onClick={() => acceptNewVersion(row.type)}
              >
                {t('profile.privacy.consentAccept')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}

      <ConfirmDialog
        open={isRevokeOpen}
        title={t('profile.privacy.revokeTitle')}
        description={t('profile.privacy.revokeDescription')}
        confirmLabel={t('profile.privacy.revokeConfirm')}
        cancelLabel={t('profile.privacy.revokeKeep')}
        danger
        isLoading={isSaving}
        onConfirm={confirmRevoke}
        onClose={closeRevoke}
      />
    </Card>
  );
}
