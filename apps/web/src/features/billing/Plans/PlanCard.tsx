import type { PlanTier, PlanView } from '@english-saas/api-client';
import { Badge, Button, Card } from '@english-saas/ui';
import { Check } from 'lucide-react';

import { t } from '../../../messages/pt-BR';

const TIER_LABELS: Record<PlanTier, string> = {
  FREE: 'Gratuito',
  BASE: 'Base',
  PLUS: 'Plus',
};

const TIER_FEATURES: Record<PlanTier, string[]> = {
  FREE: [
    'A primeira unidade de cada nível (A1 ao C1)',
    'Correção de produção livre e roleplay com IA (cota menor)',
    'Cronograma e revisão espaçada',
  ],
  BASE: [
    'Todo o catálogo, em qualquer nível',
    'Apostila em PDF de cada unidade',
    'Correção de produção livre e roleplay com IA (cota maior)',
    'Cronograma e revisão espaçada',
  ],
  PLUS: [
    'Tudo do Base',
    'Material a partir de um tema do seu interesse',
    'Material a partir de um texto, notícia ou música que você trouxer',
    'Roleplay com cenário livre e mais crédito de IA',
  ],
};

export function PlanCard({
  tier,
  plan,
  isCurrent,
  onSubscribe,
}: {
  tier: PlanTier;
  plan: PlanView | undefined;
  isCurrent: boolean;
  onSubscribe: (plan: PlanView) => void;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">{TIER_LABELS[tier]}</h2>
        {isCurrent ? (
          <Badge tone="accent">{t('plans.currentBadge')}</Badge>
        ) : null}
      </div>

      <p className="font-display text-2xl text-ink">
        {plan?.priceLabel ?? '—'}
      </p>

      <ul className="flex flex-col gap-2">
        {TIER_FEATURES[tier].map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-ink">
            <Check
              className="mt-0.5 size-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>

      {tier === 'FREE' ? null : (
        <Button
          variant={isCurrent ? 'ghost' : 'primary'}
          disabled={isCurrent || plan === undefined}
          onClick={() => plan && onSubscribe(plan)}
        >
          {isCurrent ? t('plans.currentBadge') : t('plans.subscribe')}
        </Button>
      )}
    </Card>
  );
}
