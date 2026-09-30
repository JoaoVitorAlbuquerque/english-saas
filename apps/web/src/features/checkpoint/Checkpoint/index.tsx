import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ItemRenderer,
  ProgressBar,
  toItemView,
} from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import { useCheckpointController } from './useCheckpointController';

const RESULT_TONE: Record<string, 'ok' | 'accent' | 'muted'> = {
  PASSED: 'ok',
  PASSED_WITH_REINFORCEMENT: 'accent',
  NEEDS_REINFORCEMENT: 'muted',
};

export function Checkpoint({
  unitId,
  onClose,
}: {
  unitId: string;
  onClose: () => void;
}) {
  const {
    phase,
    state,
    onBegin,
    isBeginning,
    beginError,
    onAnswer,
    isSubmitting,
    submitError,
  } = useCheckpointController(unitId);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        {phase === 'INTRO' ? (
          <div className="flex flex-col gap-4">
            <DialogTitle className="font-display text-lg text-ink">
              {t('checkpoint.intro.title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted">
              {t('checkpoint.intro.description')}
            </DialogDescription>
            {beginError ? (
              <p role="alert" className="text-sm text-error">
                {beginError.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                {t('checkpoint.intro.cancel')}
              </Button>
              <Button onClick={onBegin} disabled={isBeginning}>
                {t('checkpoint.intro.start')}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'IN_PROGRESS' && state?.next ? (
          <div className="flex flex-col gap-4">
            <ProgressBar
              value={state.answered}
              max={state.maxItems}
              label={t('checkpoint.progress')}
            />
            <ItemRenderer
              key={state.next.id}
              item={toItemView(state.next, state.next.assets)}
              mode="assessment"
              onAnswer={onAnswer}
              disabled={isSubmitting}
            />
            {submitError ? (
              <p role="alert" className="text-sm text-error">
                {submitError.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === 'RESULT' && state?.result ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <DialogTitle className="font-display text-lg text-ink">
                {t('checkpoint.result.title')}
              </DialogTitle>
              <Badge tone={RESULT_TONE[state.result.result] ?? 'muted'}>
                {Math.round(state.result.score * 100)}%
              </Badge>
            </div>
            <DialogDescription className="text-sm text-muted">
              {state.result.message}
            </DialogDescription>
            {state.result.reinforce.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-ink">
                  {t('checkpoint.result.reinforceTitle')}
                </h3>
                <ul className="flex flex-col gap-1">
                  {state.result.reinforce.map((skill) => (
                    <li
                      key={skill.skillId}
                      className="rounded-lg bg-ground px-3 py-2 text-sm text-ink"
                    >
                      {skill.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button onClick={onClose} className="self-end">
              {t('checkpoint.result.close')}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
