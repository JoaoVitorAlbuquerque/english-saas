import { Button, Card } from '@english-saas/ui';
import { Download, Loader2 } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import type { usePrivacyController } from './usePrivacyController';

type DataExport = ReturnType<typeof usePrivacyController>['dataExport'];

export function ExportSection({ dataExport }: { dataExport: DataExport }) {
  const {
    state,
    isChecking,
    checkFailed,
    isRequesting,
    error,
    request,
    readyInfo,
  } = dataExport;

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-ink">
          {t('profile.export.title')}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t('profile.export.description')}
        </p>
      </div>

      {checkFailed ? (
        <p role="alert" className="text-sm text-error">
          {t('profile.export.loadError')}
        </p>
      ) : null}

      {state.kind === 'pending' ? (
        <p role="status" className="flex items-start gap-2 text-sm text-muted">
          <Loader2
            className="mt-0.5 size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
          {t('profile.export.pending')}
        </p>
      ) : null}

      {state.kind === 'ready' ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm text-ok">
            {t('profile.export.ready')}
          </p>
          {readyInfo ? <p className="text-sm text-muted">{readyInfo}</p> : null}
          <div className="flex flex-wrap gap-2">
            <a
              href={state.downloadUrl}
              download="meus-dados-english-saas.json"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-base font-medium text-white hover:opacity-90"
            >
              <Download className="size-4" aria-hidden="true" />
              {t('profile.export.download')}
            </a>
            <Button variant="ghost" onClick={request} isLoading={isRequesting}>
              {t('profile.export.requestAgain')}
            </Button>
          </div>
        </div>
      ) : null}

      {state.kind === 'expired' ? (
        <p className="text-sm text-muted">{t('profile.export.expired')}</p>
      ) : null}

      {state.kind === 'failed' ? (
        <p role="alert" className="text-sm text-error">
          {t('profile.export.failed')}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      {state.kind === 'none' ||
      state.kind === 'expired' ||
      state.kind === 'failed' ? (
        <Button
          className="self-start"
          onClick={request}
          isLoading={isRequesting}
          disabled={isChecking}
        >
          {state.kind === 'none'
            ? t('profile.export.request')
            : state.kind === 'failed'
              ? t('profile.export.retry')
              : t('profile.export.requestAgain')}
        </Button>
      ) : null}
    </Card>
  );
}
