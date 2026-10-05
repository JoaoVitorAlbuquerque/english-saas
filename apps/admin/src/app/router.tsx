import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from '../components/layout/AppShell';
import { Login } from '../features/auth/Login';
import { Characters } from '../features/curriculum/Characters';
import { CurriculumTree } from '../features/curriculum/CurriculumTree';
import { LessonVersions } from '../features/curriculum/LessonVersions';
import { VersionEditor } from '../features/curriculum/VersionEditor';
import { Dashboard } from '../pages/Dashboard';
import { Forbidden } from '../pages/Forbidden';
import { NotFound } from '../pages/NotFound';
import { AuthGuard } from './AuthGuard';

/** As rotas sem o roteador — os testes montam num `MemoryRouter`. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthGuard isPrivate={false} />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route path="/403" element={<Forbidden />} />

      <Route element={<AuthGuard isPrivate />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/conteudo" element={<CurriculumTree />} />
          <Route path="/conteudo/personagens" element={<Characters />} />
          <Route
            path="/conteudo/licoes/:lessonId"
            element={<LessonVersions />}
          />
        </Route>

        {/* O editor divide a tela com o preview: sem teto de largura. */}
        <Route element={<AppShell width="wide" />}>
          <Route
            path="/conteudo/versoes/:versionId"
            element={<VersionEditor />}
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
