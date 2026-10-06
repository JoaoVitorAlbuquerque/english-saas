import { Badge } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

/**
 * Selo de "obsoleta" e, quando existe, a substituta. Sempre com texto: a cor
 * do selo sozinha não diz o que aconteceu.
 */
export function ObsoleteNote({
  deprecatedAt,
  replacedById,
}: {
  deprecatedAt: string | null;
  replacedById: string | null;
}) {
  if (deprecatedAt === null) {
    return null;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted">
      <Badge tone="error">{t('taxonomy.obsolete')}</Badge>
      {replacedById === null ? (
        <span>{t('taxonomy.noReplacement')}</span>
      ) : (
        <span>
          {t('taxonomy.replacedBy')}{' '}
          <span className="font-mono">{replacedById}</span>
        </span>
      )}
    </span>
  );
}
