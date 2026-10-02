import { Outlet } from 'react-router-dom';

import { DesktopSidebar } from './DesktopSidebar';
import { MobileTabBar } from './MobileTabBar';

/** Barra inferior no celular, barra lateral a partir de `md` — só CSS, sem JS de breakpoint. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-ground">
      <DesktopSidebar />
      {/* `min-w-0`: sem isso, o item flex cresce até o conteúdo mais largo
          (um gráfico que rola por dentro) e a página ganha rolagem lateral. */}
      <main className="min-w-0 flex-1 pb-16 md:pb-0">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <Outlet />
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}
