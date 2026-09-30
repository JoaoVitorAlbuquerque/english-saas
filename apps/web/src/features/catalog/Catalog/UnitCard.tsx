import type { CatalogUnit } from '@english-saas/api-client';
import { Badge, Card } from '@english-saas/ui';
import { Lock } from 'lucide-react';

import { t } from '../../../messages/pt-BR';

const REQUIRED_PLAN_LABELS: Record<string, string> = {
  BASE: 'Base',
  PLUS: 'Plus',
};

export function UnitCard({
  unit,
  onOpen,
}: {
  unit: CatalogUnit;
  onOpen: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer flex-col gap-3 transition-shadow hover:shadow-md"
    >
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-ground">
        {unit.cover ? (
          <img src={unit.cover.url} alt="" className="size-full object-cover" />
        ) : (
          <span className="font-display text-2xl text-muted">
            {unit.level.cefrLevel}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base text-ink">{unit.title}</h3>
        {unit.locked ? (
          <Badge tone="muted" className="shrink-0 gap-1">
            <Lock className="size-3" aria-hidden="true" />
            {unit.requiredPlan
              ? (REQUIRED_PLAN_LABELS[unit.requiredPlan] ?? unit.requiredPlan)
              : t('catalog.locked')}
          </Badge>
        ) : null}
      </div>
      {unit.synopsis ? (
        <p className="line-clamp-2 text-sm text-muted">{unit.synopsis}</p>
      ) : null}
      <p className="text-xs text-muted">
        {unit.lessons.length === 1
          ? '1 lição'
          : `${String(unit.lessons.length)} lições`}
      </p>
    </Card>
  );
}
