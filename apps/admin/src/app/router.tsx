import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../components/layout/AppShell';
import { Login } from '../features/auth/Login';
import { Characters } from '../features/curriculum/Characters';
import { CurriculumTree } from '../features/curriculum/CurriculumTree';
import { LessonVersions } from '../features/curriculum/LessonVersions';
import { VersionEditor } from '../features/curriculum/VersionEditor';
import { ItemBank } from '../features/items/ItemBank';
import { ItemEditor } from '../features/items/ItemEditor';
import { ErrorPatterns } from '../features/taxonomy/ErrorPatterns';
import { RegisterNotes } from '../features/taxonomy/RegisterNotes';
import { Skills } from '../features/taxonomy/Skills';
import { TaxonomyLayout } from '../features/taxonomy/TaxonomyLayout';
import { DraftQueue } from '../features/studio/DraftQueue';
import { NewDraft } from '../features/studio/NewDraft';
import { StudioLayout } from '../features/studio/StudioLayout';
import { Workbooks } from '../features/studio/Workbooks';
import { AuditLog } from '../features/management/AuditLog';
import { Metrics } from '../features/management/Metrics';
import { Plans } from '../features/management/Plans';
import { StudentProfile } from '../features/management/StudentProfile';
import { Students } from '../features/management/Students';
import { Dashboard } from '../pages/Dashboard';
import { Forbidden } from '../pages/Forbidden';
import { NotFound } from '../pages/NotFound';
import { AuthGuard } from './AuthGuard';
import { RoleGuard } from './RoleGuard';

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

        {/* O editor divide a tela com o preview e as listas são tabelas: sem teto de largura. */}
        <Route element={<AppShell width="wide" />}>
          <Route path="/conteudo/questoes" element={<ItemBank />} />
          <Route path="/conteudo/questoes/nova" element={<ItemEditor />} />
          <Route path="/conteudo/questoes/:itemId" element={<ItemEditor />} />
          <Route path="/conteudo/taxonomia" element={<TaxonomyLayout />}>
            <Route index element={<Navigate to="skills" replace />} />
            <Route path="skills" element={<Skills />} />
            <Route path="erros" element={<ErrorPatterns />} />
            <Route path="registro" element={<RegisterNotes />} />
          </Route>

          <Route path="/estudio" element={<StudioLayout />}>
            <Route index element={<DraftQueue />} />
            <Route path="novo" element={<NewDraft />} />
            <Route path="apostilas" element={<Workbooks />} />
          </Route>

          <Route
            path="/conteudo/versoes/:versionId"
            element={<VersionEditor />}
          />

          {/* Gestão: só ADMIN (a API também recusa o editor). */}
          <Route element={<RoleGuard />}>
            <Route path="/alunos" element={<Students />} />
            <Route path="/alunos/:userId" element={<StudentProfile />} />
            <Route path="/assinaturas" element={<Plans />} />
            <Route path="/metricas" element={<Metrics />} />
            <Route path="/auditoria" element={<AuditLog />} />
          </Route>
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
