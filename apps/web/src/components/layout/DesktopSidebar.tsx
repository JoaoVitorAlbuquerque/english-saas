import { cn } from '@english-saas/ui';
import { NavLink } from 'react-router-dom';

import { NAV_ITEMS } from './nav-items';

export function DesktopSidebar() {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex"
    >
      <span className="mb-4 px-2 font-display text-lg text-ink">
        english-saas
      </span>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
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
      ))}
    </nav>
  );
}
