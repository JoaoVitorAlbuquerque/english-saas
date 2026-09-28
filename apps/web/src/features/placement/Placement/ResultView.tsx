import type { ApiError, PlacementResult } from '@english-saas/api-client';
import { Badge, Button, Card } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { canDoFor } from './can-do-statements';

export function ResultView({
  result,
  onRetake,
  isRetaking,
  retakeError,
  goToToday,
}: {
  result: PlacementResult;
  onRetake: () => void;
  isRetaking: boolean;
  retakeError: ApiError | null;
  goToToday: () => void;
}) {
  const canRetake =
    result.nextAvailableAt === null ||
    new Date(result.nextAvailableAt).getTime() <= Date.now();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-ground p-4">
      <Card className="text-center">
        <p className="text-sm text-muted">{t('placement.result.title')}</p>
        <p className="mt-1 font-display text-3xl text-ink">{result.label}</p>
        {result.note ? (
          <p className="mt-3 text-sm text-muted">{result.note}</p>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg text-ink">
          {t('placement.result.canDoTitle')}
        </h2>
        {result.competencies.map((competency) => (
          <Card key={competency.competency}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-ink">{competency.label}</p>
              <Badge tone="accent">{competency.level}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {canDoFor(competency.competency, competency.level)}
            </p>
          </Card>
        ))}
      </div>

      <Button onClick={goToToday}>{t('placement.result.goToToday')}</Button>

      <div className="flex flex-col items-center gap-2 text-center">
        <Button
          variant="ghost"
          disabled={!canRetake || isRetaking}
          isLoading={isRetaking}
          onClick={onRetake}
        >
          {t('placement.result.retake')}
        </Button>
        {!canRetake && result.nextAvailableAt ? (
          <p className="text-sm text-muted">
            {t('placement.result.retakeAvailableFrom')}{' '}
            {new Date(result.nextAvailableAt).toLocaleDateString('pt-BR')}
          </p>
        ) : null}
        {retakeError ? (
          <p role="alert" className="text-sm text-error">
            {retakeError.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
