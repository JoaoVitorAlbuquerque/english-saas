import { EmptyState } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../messages/pt-BR';

export function Forbidden() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
      <EmptyState
        title={t('forbidden.title')}
        description={t('forbidden.description')}
        action={
          <Link to="/login" className="text-sm font-medium text-accent">
            {t('forbidden.backToLogin')}
          </Link>
        }
      />
    </div>
  );
}
