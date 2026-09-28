import { Navigate, Outlet } from 'react-router-dom';

import { FullScreenLoader } from '../components/FullScreenLoader';
import { useAuthStore } from '../stores/auth-store';

/** `isPrivate` decide o redirecionamento: telas do aluno x telas de auth. */
export function AuthGuard({ isPrivate }: { isPrivate: boolean }) {
  const status = useAuthStore((state) => state.status);

  if (status === 'checking') {
    return <FullScreenLoader label="Carregando sessão…" />;
  }

  if (isPrivate && status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  if (!isPrivate && status === 'authenticated') {
    return <Navigate to="/hoje" replace />;
  }

  return <Outlet />;
}
