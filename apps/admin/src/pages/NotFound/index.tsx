import { EmptyState } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../messages/pt-BR';

export function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
      <EmptyState
        title={t('notFound.title')}
        description={t('notFound.description')}
        action={
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 font-medium text-white hover:opacity-90"
          >
            {t('notFound.backHome')}
          </Link>
        }
      />
    </div>
  );
}
