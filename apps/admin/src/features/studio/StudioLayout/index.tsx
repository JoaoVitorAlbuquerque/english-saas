import { NavLink, Outlet } from 'react-router-dom';

import { t, type MessageKey } from '../../../messages/pt-BR';

const TABS: { to: string; end: boolean; label: MessageKey }[] = [
  { to: '/estudio', end: true, label: 'studio.tab.queue' },
  { to: '/estudio/novo', end: false, label: 'studio.tab.new' },
  { to: '/estudio/apostilas', end: false, label: 'studio.tab.workbooks' },
];

/** Moldura das telas do estúdio: título e abas. */
export function StudioLayout() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-ink">{t('studio.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t('studio.subtitle')}
        </p>
      </header>

      <nav
        aria-label={t('studio.tabs')}
        className="flex gap-1 border-b border-line"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                isActive
                  ? 'border-accent text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`
            }
          >
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
