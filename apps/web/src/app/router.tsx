import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ForgotPassword } from '../features/auth/ForgotPassword';
import { GoogleCallback } from '../features/auth/GoogleCallback';
import { Login } from '../features/auth/Login';
import { ResetPassword } from '../features/auth/ResetPassword';
import { Signup } from '../features/auth/Signup';
import { VerifyEmail } from '../features/auth/VerifyEmail';
import { Catalog } from '../features/catalog/Catalog';
import { Unit } from '../features/catalog/Unit';
import { Checkout } from '../features/billing/Checkout';
import { Plans } from '../features/billing/Plans';
import { Subscription } from '../features/billing/Subscription';
import { GenerationJob } from '../features/generator/GenerationJob';
import { IngestRequest } from '../features/generator/IngestRequest';
import { Material } from '../features/generator/Material';
import { Materials } from '../features/generator/Materials';
import { Tools } from '../features/generator/Tools';
import { TopicRequest } from '../features/generator/TopicRequest';
import { Availability } from '../features/onboarding/Availability';
import { Consents } from '../features/onboarding/Consents';
import { Finish } from '../features/onboarding/Finish';
import { Goal } from '../features/onboarding/Goal';
import { Interests } from '../features/onboarding/Interests';
import { Level } from '../features/onboarding/Level';
import { OnboardingLayout } from '../features/onboarding/OnboardingLayout';
import { NotificationSettings } from '../features/profile/NotificationSettings';
import { Privacy } from '../features/profile/Privacy';
import { Profile } from '../features/profile/Profile';
import { StudySettings } from '../features/profile/StudySettings';
import { Progress } from '../features/progress/Progress';
import { Today } from '../features/today/Today';
import { Review } from '../features/review/Review';
import { Lesson } from '../features/lesson/Lesson';
import { Placement } from '../features/placement/Placement';
import { NotFound } from '../pages/NotFound';
import { AppShell } from '../components/layout/AppShell';
import { Paywall } from '../components/Paywall/Paywall';
import { AuthGuard } from './AuthGuard';
import { RequireNotOnboarded } from './RequireNotOnboarded';
import { RequireOnboarded } from './RequireOnboarded';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Paywall />
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
              <Route path="/unidades/:slug" element={<Unit />} />
              <Route path="/progresso" element={<Progress />} />
              <Route path="/ferramentas" element={<Tools />} />
              <Route path="/ferramentas/tema" element={<TopicRequest />} />
              <Route path="/ferramentas/colar" element={<IngestRequest />} />
              <Route
                path="/ferramentas/pedidos/:jobId"
                element={<GenerationJob />}
              />
              <Route path="/materiais" element={<Materials />} />
              <Route path="/materiais/:materialId" element={<Material />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/perfil/estudo" element={<StudySettings />} />
              <Route
                path="/perfil/notificacoes"
                element={<NotificationSettings />}
              />
              <Route path="/perfil/privacidade" element={<Privacy />} />
            </Route>
            <Route path="/nivelamento" element={<Placement />} />
            <Route path="/licoes/:slug" element={<Lesson />} />
            <Route path="/planos" element={<Plans />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/minha-assinatura" element={<Subscription />} />
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
