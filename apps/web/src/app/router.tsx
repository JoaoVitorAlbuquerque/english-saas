import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Login } from '../features/auth/Login';
import { Signup } from '../features/auth/Signup';
import { Catalog } from '../features/catalog/Catalog';
import { Profile } from '../features/profile/Profile';
import { Progress } from '../features/progress/Progress';
import { Today } from '../features/today/Today';
import { NotFound } from '../pages/NotFound';
import { AppShell } from '../components/layout/AppShell';
import { AuthGuard } from './AuthGuard';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/hoje" replace />} />

        <Route element={<AuthGuard isPrivate={false} />}>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Signup />} />
        </Route>

        <Route element={<AuthGuard isPrivate />}>
          <Route element={<AppShell />}>
            <Route path="/hoje" element={<Today />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/progresso" element={<Progress />} />
            <Route path="/perfil" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
