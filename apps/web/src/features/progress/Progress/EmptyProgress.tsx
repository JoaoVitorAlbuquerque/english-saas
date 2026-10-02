import { EmptyState } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LINK_BUTTON_CLASS } from '../../generator/components/link-button';

/** Aluno novo: o convite no lugar de gráficos vazios. */
export function EmptyProgress() {
  return (
    <EmptyState
      title={t('progress.empty.title')}
      description={t('progress.empty.description')}
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/nivelamento" className={LINK_BUTTON_CLASS}>
            {t('progress.empty.placement')}
          </Link>
          <Link
            to="/hoje"
            className="inline-flex h-11 items-center text-sm font-medium text-accent underline"
          >
            {t('progress.empty.today')}
          </Link>
        </div>
      }
    />
  );
}
