import { ArrowLeft } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';

const TABS = [
  { to: '/conteudo/taxonomia/skills', label: 'taxonomy.tab.skills' },
  { to: '/conteudo/taxonomia/erros', label: 'taxonomy.tab.errors' },
  { to: '/conteudo/taxonomia/registro', label: 'taxonomy.tab.notes' },
] as const;

/** Moldura das três listas da taxonomia: título e abas. */
export function TaxonomyLayout() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        to="/conteudo"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('taxonomy.back')}
      </Link>

      <header>
        <h1 className="font-display text-2xl text-ink">
          {t('taxonomy.title')}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('taxonomy.subtitle')}</p>
      </header>

      <nav
        aria-label={t('taxonomy.tabs')}
        className="flex gap-1 border-b border-line"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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
