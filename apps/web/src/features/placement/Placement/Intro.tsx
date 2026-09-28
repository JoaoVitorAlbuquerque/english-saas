import type { ApiError } from '@english-saas/api-client';
import { Button, Card } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

export function Intro({
  onBegin,
  isBeginning,
  beginError,
}: {
  onBegin: () => void;
  isBeginning: boolean;
  beginError: ApiError | null;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="font-display text-2xl text-ink">
          {t('placement.intro.title')}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t('placement.intro.description')}
        </p>
        <p className="mt-4 rounded-xl bg-accent/10 p-3 text-sm text-accent">
          {t('placement.intro.dontKnowHint')}
        </p>

        {beginError ? (
          <p role="alert" className="mt-4 text-sm text-error">
            {beginError.message}
          </p>
        ) : null}

        <Button
          className="mt-6 w-full"
          onClick={onBegin}
          isLoading={isBeginning}
        >
          {t('placement.intro.begin')}
        </Button>
      </Card>
    </div>
  );
}
