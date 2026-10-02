import type { NotificationPreferences } from '@english-saas/api-client';
import { Button, Card } from '@english-saas/ui';
import { BellRing } from 'lucide-react';

import { t } from '../../../messages/pt-BR';
import { usePushController } from './usePushController';

/** Avisos no navegador. A permissão só é pedida no clique de "Ativar". */
export function PushSection({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const {
    view,
    devices,
    blockedMessage,
    noticeMessage,
    isBusy,
    isTesting,
    enable,
    disable,
    sendTest,
  } = usePushController(preferences);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <BellRing
          className="mt-0.5 size-5 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-sm font-medium text-ink">
            {t('profile.push.title')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('profile.push.description')}
          </p>
        </div>
      </div>

      {blockedMessage ? (
        <p className="text-sm text-muted">{blockedMessage}</p>
      ) : null}

      {view === 'active' ? (
        <>
          <p role="status" className="text-sm text-ok">
            {devices === 1
              ? t('profile.push.activeOne', { count: devices })
              : t('profile.push.activeMany', { count: devices })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={sendTest}
              isLoading={isTesting}
              disabled={isBusy}
            >
              {t('profile.push.test')}
            </Button>
            <Button variant="ghost" onClick={disable} isLoading={isBusy}>
              {t('profile.push.disable')}
            </Button>
          </div>
        </>
      ) : null}

      {view === 'inactive' || view === 'denied' ? (
        <>
          {view === 'inactive' && devices > 0 ? (
            <p className="text-sm text-muted">
              {t('profile.push.activeNotHere')}
            </p>
          ) : null}
          {view === 'inactive' ? (
            <Button className="self-start" onClick={enable} isLoading={isBusy}>
              {t('profile.push.enable')}
            </Button>
          ) : null}
        </>
      ) : null}

      {noticeMessage ? (
        <p role="alert" className="text-sm text-error">
          {noticeMessage}
        </p>
      ) : null}
    </Card>
  );
}
