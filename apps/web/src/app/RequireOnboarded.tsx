import { useProfile } from '@english-saas/api-client';
import { ErrorState } from '@english-saas/ui';
import { Navigate, Outlet } from 'react-router-dom';

import { FullScreenLoader } from '../components/FullScreenLoader';

/** Só deixa passar quem já terminou o onboarding — senão, manda para lá. */
export function RequireOnboarded() {
  const { data, isLoading, isError, refetch, isRefetching } = useProfile();

  if (isLoading) {
    return <FullScreenLoader label="Carregando seu perfil…" />;
  }

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
        <ErrorState onRetry={() => void refetch()} />
        {isRefetching ? (
          <span className="sr-only">Tentando de novo…</span>
        ) : null}
      </div>
    );
  }

  if (!data || data.onboardingCompletedAt === null) {
    return <Navigate to="/onboarding/objetivo" replace />;
  }

  return <Outlet />;
}
