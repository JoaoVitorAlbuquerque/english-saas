import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';

export function BackToProfile() {
  return (
    <Link
      to="/perfil"
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-accent"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      {t('profile.back')}
    </Link>
  );
}
