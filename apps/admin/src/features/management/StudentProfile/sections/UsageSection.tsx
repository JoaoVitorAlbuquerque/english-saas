import { t } from '../../../../messages/pt-BR';
import { Section } from '../../components/Section';
import { formatUsdMicros } from '../../../studio/lib/format-usd';
import { aiFeatureLabel, formatInt } from '../../lib/labels';
import type { StudentProfileView } from '../useStudentProfileController';

export function UsageSection({
  usage,
}: {
  usage: StudentProfileView['usage'];
}) {
  const data = usage.data;

  return (
    <Section
      id="student-usage"
      title={t('student.usage.title')}
      description={t('student.usage.description')}
      isLoading={usage.isLoading}
      error={usage.error}
      onRetry={usage.retry}
    >
      {data && data.totals.calls === 0 ? (
        <p className="text-sm text-muted">{t('student.usage.empty')}</p>
      ) : null}

      {data && data.totals.calls > 0 ? (
        <div className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">{t('student.usage.calls')}</dt>
              <dd className="font-mono text-lg text-ink">
                {formatInt(data.totals.calls)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">
                {t('student.usage.tokensIn')}
              </dt>
              <dd className="font-mono text-lg text-ink">
                {formatInt(data.totals.inputTokens)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">
                {t('student.usage.tokensOut')}
              </dt>
              <dd className="font-mono text-lg text-ink">
                {formatInt(data.totals.outputTokens)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t('student.usage.cost')}</dt>
              <dd className="font-mono text-lg text-ink">
                {formatUsdMicros(data.totals.costUsdMicros)}
              </dd>
            </div>
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="mb-1 text-left text-xs text-muted">
                {t('student.usage.byFeature')}
              </caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t('student.usage.col.feature')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('student.usage.calls')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('student.usage.cost')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byFeature.map((row) => (
                  <tr key={row.feature} className="border-t border-line">
                    <td className="py-2 pr-3 text-ink">
                      {aiFeatureLabel(row.feature)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatInt(row.calls)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUsdMicros(row.costUsdMicros)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
