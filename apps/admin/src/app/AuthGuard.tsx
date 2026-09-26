import { Navigate, Outlet } from 'react-router-dom';

import { hasAdminAccess, useAuthStore } from '../stores/auth-store';

export function AuthGuard({ isPrivate }: { isPrivate: boolean }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground">
        <span className="sr-only">Carregando sessão…</span>
      </div>
    );
  }

  if (isPrivate && status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  if (isPrivate && status === 'authenticated' && !hasAdminAccess(user)) {
    return <Navigate to="/403" replace />;
  }

  if (!isPrivate && status === 'authenticated' && hasAdminAccess(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
