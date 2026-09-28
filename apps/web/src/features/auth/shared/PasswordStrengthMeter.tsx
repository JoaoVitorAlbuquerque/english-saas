import { cn } from '@english-saas/ui';

import { t } from '../../../messages/pt-BR';
import {
  estimatePasswordStrength,
  type PasswordStrengthScore,
} from './password-strength';

const SEGMENT_COUNT = 4;

const SCORE_LABEL_KEYS = [
  'passwordStrength.0',
  'passwordStrength.1',
  'passwordStrength.2',
  'passwordStrength.3',
  'passwordStrength.4',
] as const;

function scoreLabel(score: PasswordStrengthScore): string {
  return t(SCORE_LABEL_KEYS[score]);
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (password.length === 0) {
    return null;
  }

  const score = estimatePasswordStrength(password);
  const tone = score <= 1 ? 'bg-error' : score <= 2 ? 'bg-chunk' : 'bg-ok';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              index < score ? tone : 'bg-line',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted">
        {t('passwordStrength.label')}: {scoreLabel(score)}
      </p>
    </div>
  );
}
