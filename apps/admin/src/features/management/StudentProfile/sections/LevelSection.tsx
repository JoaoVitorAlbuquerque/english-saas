import { BarChart, LineChart } from '@english-saas/ui';

import { t } from '../../../../messages/pt-BR';
import { Section } from '../../components/Section';
import {
  BAR_SCALE,
  LINE_SCALE,
  competencyBars,
  levelAt,
  overallPoints,
} from '../../lib/level-scale';
import type { StudentProfileView } from '../useStudentProfileController';

export function LevelSection({
  progress,
}: {
  progress: StudentProfileView['progress'];
}) {
  const level = progress.data?.level;

  return (
    <Section
      id="student-level"
      title={t('student.level.title')}
      description={t('student.level.description')}
      isLoading={progress.isLoading}
      error={progress.error}
      onRetry={progress.retry}
    >
      {level ? (
        <div className="space-y-6">
          <p className="text-sm text-ink">
            {t('student.level.overall', {
              level: level.overall.level,
              label: level.overall.label,
            })}
          </p>
          <BarChart
            title={t('student.level.title')}
            items={competencyBars(
              level.competencies,
              t('student.level.lowConfidence'),
            )}
            scale={BAR_SCALE}
            hatchedLegend={t('student.level.lowConfidence')}
            rowHeader={t('student.level.competency')}
            valueHeader={t('student.level.value')}
            emptyLabel={t('student.level.noLevel')}
          />
          <LineChart
            title={t('student.level.evolution')}
            description={t('student.level.evolutionDescription')}
            series={[
              {
                id: 'overall',
                label: t('student.level.evolution'),
                points: overallPoints(level.weekly),
              },
            ]}
            scale={LINE_SCALE}
            formatY={(value) => levelAt(value) ?? String(value)}
            rowHeader={t('student.level.week')}
            emptyLabel={t('student.level.noLevel')}
          />
        </div>
      ) : null}
    </Section>
  );
}
