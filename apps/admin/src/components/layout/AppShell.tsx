import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';

/** Painel só de desktop — sem barra inferior nem adaptação mobile. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-ground">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
