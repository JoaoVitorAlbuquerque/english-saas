import { t } from '../../../../messages/pt-BR';
import { Section } from '../../components/Section';
import type { StudentProfileView } from '../useStudentProfileController';

export function StrengthsSection({
  progress,
}: {
  progress: StudentProfileView['progress'];
}) {
  const data = progress.data;

  return (
    <Section
      id="student-strengths"
      title={t('student.strengths.title')}
      isLoading={progress.isLoading}
      error={progress.error}
      onRetry={progress.retry}
    >
      {data ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">
              {t('student.strengths.strengths')}
            </h3>
            {data.strengths.length === 0 ? (
              <p className="text-sm text-muted">
                {t('student.strengths.noStrengths')}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.strengths.map((strength) => (
                  <li key={strength.skillId}>
                    <p className="font-medium text-ink">{strength.title}</p>
                    <p className="text-muted">{strength.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">
              {t('student.strengths.weaknesses')}
            </h3>
            {data.weaknesses.length === 0 ? (
              <p className="text-sm text-muted">
                {t('student.strengths.noWeaknesses')}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.weaknesses.map((weakness) => (
                  <li key={weakness.skillId}>
                    <p className="font-medium text-ink">{weakness.title}</p>
                    <p className="text-muted">{weakness.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">
              {t('student.strengths.errors')}
            </h3>
            {data.stats.topErrors.length === 0 ? (
              <p className="text-sm text-muted">
                {t('student.strengths.noErrors')}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.stats.topErrors.map((entry) => (
                  <li key={entry.errorPatternId}>
                    <p className="font-medium text-ink">{entry.description}</p>
                    <p className="text-muted">{entry.correction}</p>
                    <p className="text-xs text-muted">
                      {t('student.strengths.errorCounts', {
                        recent: entry.recentOccurrences,
                        opportunities: entry.opportunities,
                        trend: entry.trendLabel,
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
