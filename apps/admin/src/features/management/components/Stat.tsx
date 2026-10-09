import { Card } from '@english-saas/ui';

/** Um número em destaque com o rótulo — o "azulejo" do topo das métricas. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="space-y-1">
      <dl>
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="font-mono text-2xl text-ink">{value}</dd>
      </dl>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
