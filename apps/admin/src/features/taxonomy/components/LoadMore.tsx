import { Button } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

/** "Carregar mais" das listas paginadas por cursor. */
export function LoadMore({
  hasMore,
  isLoading,
  onLoad,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoad: () => void;
}) {
  if (!hasMore) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <Button variant="ghost" isLoading={isLoading} onClick={onLoad}>
        {t('taxonomy.loadMore')}
      </Button>
    </div>
  );
}
