import { Badge, Card } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t } from '../../../messages/pt-BR';
import { LINK_BUTTON_CLASS } from '../../generator/components/link-button';
import type { WeaknessLinkKind } from '../lib/weakness-action';
import type { ProgressView } from './useProgressController';

const ACTION_LABEL: Record<WeaknessLinkKind, string> = {
  lesson: t('progress.action.lesson'),
  practice: t('progress.action.practice'),
  material: t('progress.action.material'),
};

export function StrengthsWeaknessesSection({
  strengths,
  weaknesses,
}: Pick<ProgressView, 'strengths' | 'weaknesses'>) {
  return (
    <section
      aria-labelledby="progress-strengths"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <Card className="flex flex-col gap-3">
        <h2 id="progress-strengths" className="font-display text-lg text-ink">
          {t('progress.strengths.title')}
        </h2>
        {strengths.length === 0 ? (
          <p className="text-sm text-muted">{t('progress.strengths.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {strengths.map((strength) => (
              <li key={strength.skillId} className="flex items-start gap-2">
                <Badge tone="ok" className="shrink-0">
                  ✓
                </Badge>
                <span className="text-sm text-ink">{strength.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg text-ink">
          {t('progress.weaknesses.title')}
        </h2>
        {weaknesses.length === 0 ? (
          <p className="text-sm text-muted">{t('progress.weaknesses.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {weaknesses.map((weakness) => (
              <li key={weakness.skillId} className="flex flex-col gap-2">
                <p className="text-sm text-ink">{weakness.text}</p>
                <Link
                  to={weakness.link.to}
                  className={LINK_BUTTON_CLASS}
                  aria-label={`${ACTION_LABEL[weakness.link.kind]}: ${weakness.title}`}
                >
                  {ACTION_LABEL[weakness.link.kind]}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
