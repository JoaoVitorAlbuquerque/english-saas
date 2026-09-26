import { Outlet } from 'react-router-dom';

import { DesktopSidebar } from './DesktopSidebar';
import { MobileTabBar } from './MobileTabBar';

/** Barra inferior no celular, barra lateral a partir de `md` — só CSS, sem JS de breakpoint. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-ground">
      <DesktopSidebar />
      <main className="flex-1 pb-16 md:pb-0">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <Outlet />
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}
