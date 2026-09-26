import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Login } from '../features/auth/Login';
import { Dashboard } from '../pages/Dashboard';
import { Forbidden } from '../pages/Forbidden';
import { NotFound } from '../pages/NotFound';
import { AppShell } from '../components/layout/AppShell';
import { AuthGuard } from './AuthGuard';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGuard isPrivate={false} />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route path="/403" element={<Forbidden />} />

        <Route element={<AuthGuard isPrivate />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
