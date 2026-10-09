import { EmptyState } from '@english-saas/ui';
import { Link, Outlet } from 'react-router-dom';

import { t } from '../messages/pt-BR';
import { isAdmin, useAuthStore } from '../stores/auth-store';

/**
 * Trava de tela das rotas de gestão: só o ADMIN passa. O editor continua no
 * painel (menu e cabeçalho ficam), com o motivo escrito — quem barra de
 * verdade é a API (`@Roles('ADMIN')`), isto só evita uma tela cheia de erro.
 */
export function RoleGuard() {
  const allowed = useAuthStore((state) => isAdmin(state.user));

  if (allowed) {
    return <Outlet />;
  }

  return (
    <div className="pt-8">
      <EmptyState
        title={t('mgmt.forbidden.title')}
        description={t('mgmt.forbidden.description')}
        action={
          <Link to="/" className="text-sm font-medium text-accent">
            {t('mgmt.forbidden.action')}
          </Link>
        }
      />
    </div>
  );
}
