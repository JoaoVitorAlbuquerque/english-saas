import { EmptyState } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../messages/pt-BR';

export function Placement() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
      <EmptyState
        title={t('placement.title')}
        description={t('placement.description')}
        action={
          <Link to="/hoje" className="text-sm font-medium text-accent">
            {t('placement.skipForNow')}
          </Link>
        }
      />
    </div>
  );
}
