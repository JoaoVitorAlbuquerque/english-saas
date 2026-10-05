import { cn } from '@english-saas/ui';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';

export type AppShellProps = {
  /**
   * `narrow` (padrão) centraliza o conteúdo num miolo de leitura; `wide` solta
   * a largura — o editor de lição divide a tela entre formulário e preview.
   */
  width?: 'narrow' | 'wide';
};

/** Painel só de desktop — sem barra inferior nem adaptação mobile. */
export function AppShell({ width = 'narrow' }: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-ground">
      <Sidebar />
      {/* `min-w-0`: sem ele o conteúdo largo empurra a página em vez de rolar por dentro. */}
      <main className="min-w-0 flex-1 p-8">
        <div className={cn('mx-auto', width === 'narrow' && 'max-w-4xl')}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
