import { Badge, Button, Card } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';

export type ReviewSummaryProps = {
  reviewedCount: number;
  dueDates: string[];
  remainingDue: number | null;
  onRestart: () => void;
  onFinish: () => void;
};

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Agrupa os próximos vencimentos em "hoje", "amanhã" e "em N dias". */
function groupDueDates(
  dueDates: string[],
  now = new Date(),
): { label: string; count: number }[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const counts = new Map<number, number>();

  for (const iso of dueDates) {
    const dueDay = new Date(iso);
    const startOfDueDay = new Date(
      dueDay.getFullYear(),
      dueDay.getMonth(),
      dueDay.getDate(),
    ).getTime();
    const daysAhead = Math.max(
      0,
      Math.round((startOfDueDay - startOfToday) / DAY_MS),
    );
    counts.set(daysAhead, (counts.get(daysAhead) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([daysAhead, count]) => ({
      label:
        daysAhead === 0
          ? t('review.summary.dueToday')
          : daysAhead === 1
            ? t('review.summary.dueTomorrow')
            : `Em ${String(daysAhead)} dias`,
      count,
    }));
}

export function ReviewSummary({
  reviewedCount,
  dueDates,
  remainingDue,
  onRestart,
  onFinish,
}: ReviewSummaryProps) {
  const groups = groupDueDates(dueDates);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 text-center">
        <h2 className="font-display text-xl text-ink">
          {t('review.summary.title')}
        </h2>
        <Badge tone="accent" className="mx-auto">
          {reviewedCount} revisado{reviewedCount === 1 ? '' : 's'}
        </Badge>
        {remainingDue !== null ? (
          <p className="text-sm text-muted">
            {remainingDue === 0
              ? t('review.summary.noneDue')
              : `Ainda restam ${String(remainingDue)} vencidos hoje.`}
          </p>
        ) : null}
      </Card>

      {groups.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted">
            {t('review.summary.dueGroupTitle')}
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {groups.map((group) => (
              <li key={group.label} className="flex justify-between">
                <span>{group.label}</span>
                <span className="text-muted">{group.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {reviewedCount > 0 ? (
          <Button variant="ghost" onClick={onRestart}>
            {t('review.summary.restart')}
          </Button>
        ) : null}
        <Button onClick={onFinish}>{t('review.summary.finish')}</Button>
      </div>
    </div>
  );
}
