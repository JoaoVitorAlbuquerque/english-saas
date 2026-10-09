import type { AdminMetrics } from '@english-saas/api-client';
import {
  ITEM_TYPE_LABELS,
  LESSON_STEP_TYPE_LABELS,
} from '@english-saas/shared';
import { Badge, Card } from '@english-saas/ui';
import { Link } from 'react-router-dom';

import { t, type MessageKey } from '../../../messages/pt-BR';
import { formatInt, formatPercent } from '../lib/labels';

const STEP_LABELS: Record<string, string> = LESSON_STEP_TYPE_LABELS;

/** A etapa onde mais gente parou naquela lição. */
function mainDropoff(metrics: AdminMetrics, lessonId: string): string | null {
  const lesson = metrics.lessons.byLesson.find(
    (entry) => entry.lessonId === lessonId,
  );
  const top = [...(lesson?.abandonmentByStep ?? [])].sort(
    (a, b) => b.count - a.count,
  )[0];

  return top === undefined
    ? null
    : t('metrics.dropoff.step', {
        n: top.stepIndex + 1,
        type:
          top.stepType === null
            ? t('metrics.dropoff.unknownType')
            : (STEP_LABELS[top.stepType] ?? top.stepType),
      });
}

export function ContentTab({ metrics }: { metrics: AdminMetrics }) {
  const { worst } = metrics.lessons;

  return (
    <div className="space-y-8">
      <Card role="region" aria-labelledby="metrics-worst" className="space-y-3">
        <div>
          <h3 id="metrics-worst" className="font-display text-lg text-ink">
            {t('metrics.content.worstTitle')}
          </h3>
          <p className="text-sm text-muted">
            {t('metrics.content.worstDescription')}
          </p>
        </div>

        {worst.length === 0 ? (
          <p className="text-sm text-muted">
            {t('metrics.content.worstEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">
                {t('metrics.content.worstCaption')}
              </caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t('metrics.content.col.lesson')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.content.col.started')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.content.col.completion')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.content.col.accuracy')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.content.col.abandoned')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('metrics.content.col.dropoff')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {worst.map((lesson) => (
                  <tr
                    key={lesson.lessonId}
                    aria-label={lesson.title ?? t('metrics.content.untitled')}
                    className="border-t border-line"
                  >
                    <td className="py-2 pr-3 text-ink">
                      {lesson.title ?? t('metrics.content.untitled')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatInt(lesson.started)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatPercent(lesson.completionRate)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {lesson.accuracy === null
                        ? t('metrics.content.noAccuracy')
                        : formatPercent(lesson.accuracy)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatInt(lesson.abandoned)}
                    </td>
                    <td className="px-3 py-2">
                      {mainDropoff(metrics, lesson.lessonId) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card role="region" aria-labelledby="metrics-items" className="space-y-3">
        <div>
          <h3 id="metrics-items" className="font-display text-lg text-ink">
            {t('metrics.content.itemsTitle')}
          </h3>
          <p className="text-sm text-muted">
            {t('metrics.content.itemsDescription')}
          </p>
        </div>

        {metrics.items.length === 0 ? (
          <p className="text-sm text-muted">
            {t('metrics.content.itemsEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">
                {t('metrics.content.itemsCaption')}
              </caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t('metrics.content.col.item')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('metrics.content.col.level')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('metrics.content.col.flags')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.content.col.correct')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t('metrics.content.col.responses')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="sr-only">
                      {t('metrics.content.openItem')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.items.map((entry) => (
                  <tr
                    key={entry.item.id}
                    aria-label={entry.item.prompt}
                    className="border-t border-line align-top"
                  >
                    <td className="max-w-sm py-2 pr-3">
                      <p className="text-xs text-muted">
                        {ITEM_TYPE_LABELS[entry.item.type]}
                      </p>
                      <p className="line-clamp-2 text-ink">
                        {entry.item.prompt}
                      </p>
                    </td>
                    <td className="px-3 py-2">{entry.item.cefrLevel}</td>
                    <td className="px-3 py-2">
                      <ul className="flex flex-wrap gap-1">
                        {entry.flags.map((flag) => (
                          <li key={flag}>
                            <Badge tone="error">
                              {t(`items.stats.flag.${flag}` as MessageKey)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatPercent(entry.pValue)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatInt(entry.responses)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/conteudo/questoes/${entry.item.id}`}
                        aria-label={`${t('metrics.content.openItem')}: ${entry.item.prompt}`}
                        className="text-accent underline"
                      >
                        {t('metrics.content.openItem')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
