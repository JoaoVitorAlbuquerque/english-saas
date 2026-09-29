import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ForgotPassword } from '../features/auth/ForgotPassword';
import { GoogleCallback } from '../features/auth/GoogleCallback';
import { Login } from '../features/auth/Login';
import { ResetPassword } from '../features/auth/ResetPassword';
import { Signup } from '../features/auth/Signup';
import { VerifyEmail } from '../features/auth/VerifyEmail';
import { Catalog } from '../features/catalog/Catalog';
import { Availability } from '../features/onboarding/Availability';
import { Consents } from '../features/onboarding/Consents';
import { Finish } from '../features/onboarding/Finish';
import { Goal } from '../features/onboarding/Goal';
import { Interests } from '../features/onboarding/Interests';
import { Level } from '../features/onboarding/Level';
import { OnboardingLayout } from '../features/onboarding/OnboardingLayout';
import { Profile } from '../features/profile/Profile';
import { Progress } from '../features/progress/Progress';
import { Today } from '../features/today/Today';
import { Review } from '../features/review/Review';
import { Lesson } from '../features/lesson/Lesson';
import { Placement } from '../features/placement/Placement';
import { NotFound } from '../pages/NotFound';
import { AppShell } from '../components/layout/AppShell';
import { AuthGuard } from './AuthGuard';
import { RequireNotOnboarded } from './RequireNotOnboarded';
import { RequireOnboarded } from './RequireOnboarded';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/hoje" replace />} />

        {/* Públicas mesmo autenticado: o Google redireciona pra cá e o link
            de confirmação pode ser aberto em outra aba, sem sessão nesta. */}
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/verificar-email" element={<VerifyEmail />} />

        <Route element={<AuthGuard isPrivate={false} />}>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Signup />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
        </Route>

        <Route element={<AuthGuard isPrivate />}>
          <Route element={<RequireOnboarded />}>
            <Route element={<AppShell />}>
              <Route path="/hoje" element={<Today />} />
              <Route path="/revisao" element={<Review />} />
              <Route path="/catalogo" element={<Catalog />} />
              <Route path="/progresso" element={<Progress />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
            <Route path="/nivelamento" element={<Placement />} />
            <Route path="/licoes/:slug" element={<Lesson />} />
            <Route path="/onboarding/final" element={<Finish />} />
          </Route>

          <Route element={<RequireNotOnboarded />}>
            <Route element={<OnboardingLayout />}>
              <Route path="/onboarding/objetivo" element={<Goal />} />
              <Route path="/onboarding/tempo" element={<Availability />} />
              <Route path="/onboarding/interesses" element={<Interests />} />
              <Route path="/onboarding/nivel" element={<Level />} />
              <Route path="/onboarding/consentimentos" element={<Consents />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
