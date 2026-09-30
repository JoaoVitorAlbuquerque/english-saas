import { Card } from '@english-saas/ui';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { usePlusToolsCard } from './usePlusToolsCard';

/**
 * Entrada das ferramentas do Plus fora da barra lateral (tela Hoje e
 * Catálogo) — no celular, é o caminho até elas. Para quem não é Plus, vira
 * uma apresentação que leva ao paywall com o exemplo de material.
 */
export function PlusToolsCard({ className }: { className?: string }) {
  const { isReady, isPlus } = usePlusToolsCard();

  if (!isReady) {
    return null;
  }

  return (
    <Card className={className}>
      <Link to="/ferramentas" className="flex items-start gap-3">
        <Sparkles
          className="mt-0.5 size-5 shrink-0 text-accent"
          aria-hidden="true"
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium text-ink">
            {isPlus ? t('tools.card.plusTitle') : t('tools.card.freeTitle')}
          </span>
          <span className="text-sm text-muted">
            {isPlus
              ? t('tools.card.plusDescription')
              : t('tools.card.freeDescription')}
          </span>
          <span className="text-sm font-medium text-accent">
            {isPlus ? t('tools.card.plusAction') : t('tools.card.freeAction')}
          </span>
        </span>
      </Link>
    </Card>
  );
}
