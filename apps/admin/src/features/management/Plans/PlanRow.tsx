import type { PlanView } from '@english-saas/api-client';
import { Badge, Button, Input } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { hasPrice } from '../lib/plan-form';
import { planName } from '../lib/plan-name';
import { usePlanRowController } from './usePlanRowController';

export function PlanRow({ plan }: { plan: PlanView }) {
  const row = usePlanRowController(plan);
  const name = planName(plan.tier, plan.billingPeriod);

  return (
    <tr aria-label={name} className="border-t border-line align-top">
      <td className="px-3 py-3">
        <p className="font-medium text-ink">{name}</p>
        <p className="text-xs text-muted">{plan.priceLabel}</p>
        {!plan.active ? (
          <Badge tone="muted">{t('plans.note.inactive')}</Badge>
        ) : null}
      </td>
      <td className="w-44 px-3 py-3">
        {hasPrice(plan) ? (
          <Input
            aria-label={`${t('plans.col.price')}: ${name}`}
            inputMode="decimal"
            autoComplete="off"
            value={row.draft.price}
            onChange={(event) => row.setField('price', event.target.value)}
            error={row.errors.price}
          />
        ) : (
          <span className="text-muted">{t('plans.noPrice')}</span>
        )}
      </td>
      <td className="w-44 px-3 py-3">
        <Input
          aria-label={`${t('plans.col.credits')}: ${name}`}
          inputMode="numeric"
          autoComplete="off"
          value={row.draft.credits}
          onChange={(event) => row.setField('credits', event.target.value)}
          error={row.errors.credits}
        />
      </td>
      <td className="px-3 py-3">
        {plan.tier === 'FREE' ? (
          <span className="text-muted">—</span>
        ) : (
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-accent)]"
              checked={row.draft.active}
              onChange={(event) => row.setField('active', event.target.checked)}
              aria-label={`${t('plans.active')}: ${name}`}
            />
            {t('plans.active')}
          </label>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          size="sm"
          disabled={!row.changed}
          isLoading={row.isSaving}
          aria-label={`${t('plans.save')}: ${name}`}
          onClick={row.save}
        >
          {t('plans.save')}
        </Button>
      </td>
    </tr>
  );
}
