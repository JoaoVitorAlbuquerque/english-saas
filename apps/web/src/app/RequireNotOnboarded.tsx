import { useProfile } from '@english-saas/api-client';
import { ErrorState } from '@english-saas/ui';
import { Navigate, Outlet } from 'react-router-dom';

import { FullScreenLoader } from '../components/FullScreenLoader';

/** Quem já completou o onboarding não vê os passos de novo. */
export function RequireNotOnboarded() {
  const { data, isLoading, isError, refetch } = useProfile();

  if (isLoading) {
    return <FullScreenLoader label="Carregando seu perfil…" />;
  }

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  if (data && data.onboardingCompletedAt !== null) {
    return <Navigate to="/hoje" replace />;
  }

  return <Outlet />;
}
