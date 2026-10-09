import { getApiBaseUrl } from '@english-saas/api-client';
import { cn } from '@english-saas/ui';
import { ExternalLink, ListTodo } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { t } from '../../messages/pt-BR';
import { isAdmin, useAuthStore } from '../../stores/auth-store';
import { NAV_ITEMS } from './nav-items';

/** O Bull Board mora na API (`/admin/queues`) e tem login próprio (basic auth). */
function queuesUrl(): string {
  return `${getApiBaseUrl()}/admin/queues`;
}

export function Sidebar() {
  const admin = useAuthStore((state) => isAdmin(state.user));
  const items = NAV_ITEMS.filter((item) => admin || !item.adminOnly);

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4"
    >
      <span className="mb-4 px-2 font-display text-lg text-ink">
        english-saas admin
      </span>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
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

      {admin ? (
        <div className="mt-auto border-t border-line pt-3">
          <a
            href={queuesUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby="queues-hint"
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted hover:bg-ground"
          >
            <ListTodo className="size-5" aria-hidden="true" />
            {t('nav.queues')}
            <ExternalLink className="ml-auto size-4" aria-hidden="true" />
          </a>
          <p id="queues-hint" className="mt-1 px-3 text-xs text-muted">
            {t('nav.queuesHint')}
          </p>
        </div>
      ) : null}
    </nav>
  );
}
