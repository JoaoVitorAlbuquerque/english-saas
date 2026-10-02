import { Button } from '@english-saas/ui';

import { InterestPicker } from '../../../components/InterestPicker';
import { t } from '../../../messages/pt-BR';
import { useInterestsController } from './useInterestsController';

export function Interests() {
  const { selected, setSelected, handleContinue } = useInterestsController();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">
          {t('onboarding.step.interests.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t('onboarding.step.interests.description')}
        </p>
      </div>

      <InterestPicker value={selected} onChange={setSelected} />

      <Button className="mt-auto" onClick={handleContinue}>
        {t('onboarding.continue')}
      </Button>
    </div>
  );
}
