import { Navigate, Outlet } from 'react-router-dom';

import { useAuthStore } from '../stores/auth-store';

/** `isPrivate` decide o redirecionamento: telas do aluno x telas de auth. */
export function AuthGuard({ isPrivate }: { isPrivate: boolean }) {
  const status = useAuthStore((state) => state.status);

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

  if (!isPrivate && status === 'authenticated') {
    return <Navigate to="/hoje" replace />;
  }

  return <Outlet />;
}
