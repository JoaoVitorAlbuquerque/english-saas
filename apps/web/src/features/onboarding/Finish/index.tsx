import { Button, Card } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useFinishController } from './useFinishController';

export function Finish() {
  const { isBeginner, goToToday, goToPlacement } = useFinishController();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="font-display text-2xl text-ink">
          {t('onboarding.finish.title')}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isBeginner
            ? t('onboarding.finish.descriptionNone')
            : t('onboarding.finish.descriptionOther')}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={goToPlacement}>
            {t('onboarding.finish.goToPlacement')}
          </Button>
          {isBeginner ? (
            <Button variant="ghost" onClick={goToToday}>
              {t('onboarding.finish.startAtA1')}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
