import { cn } from '@english-saas/ui';
import { NavLink } from 'react-router-dom';

import { t } from '../../messages/pt-BR';
import { NAV_ITEMS } from './nav-items';

export function Sidebar() {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4"
    >
      <span className="mb-4 px-2 font-display text-lg text-ink">
        english-saas admin
      </span>
      {NAV_ITEMS.map(({ to, label, icon: Icon, disabled }) =>
        disabled ? (
          <span
            key={to}
            aria-disabled="true"
            className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted/60"
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
            <span className="ml-auto text-xs">{t('nav.comingSoon')}</span>
          </span>
        ) : (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:bg-ground',
              )
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </NavLink>
        ),
      )}
    </nav>
  );
}
