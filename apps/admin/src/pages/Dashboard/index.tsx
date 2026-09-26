import { EmptyState } from '@english-saas/ui';

import { t } from '../../messages/pt-BR';

export function Dashboard() {
  return (
    <div className="pt-8">
      <EmptyState
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      />
    </div>
  );
}
