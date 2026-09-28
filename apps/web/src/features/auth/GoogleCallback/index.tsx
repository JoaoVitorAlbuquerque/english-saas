import { ErrorState } from '@english-saas/ui';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { useGoogleCallbackController } from './useGoogleCallbackController';

export function GoogleCallback() {
  const { isDenied, isError, errorMessage } = useGoogleCallbackController();

  if (isDenied || isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ground p-6">
        <ErrorState
          title={t('auth.google.deniedTitle')}
          description={errorMessage ?? t('auth.google.deniedDescription')}
        />
        <Link to="/login" className="text-sm font-medium text-accent">
          {t('auth.google.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ground text-muted">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p>{t('auth.google.loading')}</p>
    </div>
  );
}
