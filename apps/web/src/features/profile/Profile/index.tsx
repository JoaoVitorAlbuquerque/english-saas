import { Card } from '@english-saas/ui';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PlaceholderScreen } from '../../../components/PlaceholderScreen';
import { t } from '../../../messages/pt-BR';
import { useProfileController } from './useProfileController';

export function Profile() {
  const { title, description, user } = useProfileController();

  return (
    <div className="flex flex-col gap-4">
      {user ? (
        <p className="text-sm text-muted">Logado como {user.name}</p>
      ) : null}
      <Link to="/minha-assinatura">
        <Card className="flex items-center justify-between gap-3 hover:bg-ground">
          <span className="text-sm font-medium text-ink">
            {t('subscription.title')}
          </span>
          <ChevronRight className="size-4 text-muted" aria-hidden="true" />
        </Card>
      </Link>
      <PlaceholderScreen title={title} description={description} />
    </div>
  );
}
