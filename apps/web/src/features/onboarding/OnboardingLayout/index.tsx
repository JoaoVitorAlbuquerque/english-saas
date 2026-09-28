import { StepDots } from '@english-saas/ui';
import { ArrowLeft } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ONBOARDING_STEP_ORDER } from './step-order';

export function OnboardingLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(location.pathname);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-ground p-4">
      <div className="flex items-center gap-3 pt-2">
        {currentIndex > 0 ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="size-11 shrink-0" aria-hidden="true" />
        )}
        <StepDots
          total={ONBOARDING_STEP_ORDER.length}
          current={Math.max(currentIndex, 0)}
          className="flex-1 justify-center"
        />
        <span className="size-11 shrink-0" aria-hidden="true" />
      </div>
      <Outlet />
    </div>
  );
}
