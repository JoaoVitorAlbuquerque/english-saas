import type { DraftEstimate } from '@english-saas/api-client';

import { t } from '../../../messages/pt-BR';
import { formatUsdMicros } from '../lib/format-usd';

/**
 * Quanto o pedido deve custar. É a média do que os últimos pedidos do mesmo
 * tipo custaram de verdade — por isso diz de quantos pedidos veio, e fica em
 * branco (com o motivo) enquanto não há histórico.
 */
export function CostEstimate({
  estimate,
  isLoading,
}: {
  estimate: DraftEstimate | undefined;
  isLoading: boolean;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="text-sm text-muted"
      data-testid="cost-estimate"
    >
      {isLoading || estimate === undefined ? (
        t('studio.new.estimate.loading')
      ) : estimate.usdMicros === null ? (
        t('studio.new.estimate.none')
      ) : (
        <>
          {t('studio.new.estimate.label')}{' '}
          <strong className="font-mono text-ink">
            ~{formatUsdMicros(estimate.usdMicros)}
          </strong>{' '}
          · {t('studio.new.estimate.basedOn', { count: estimate.basedOn })}
        </>
      )}
    </p>
  );
}
