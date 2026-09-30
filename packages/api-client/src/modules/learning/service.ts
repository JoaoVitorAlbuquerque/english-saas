import { apiFetch } from '../../http/fetch-client';
import {
  learningStatsSchema,
  lessonHistoryPageSchema,
  type LearningStats,
  type LessonHistoryPage,
} from './schemas';

export async function getStats(): Promise<LearningStats> {
  return apiFetch('/me/stats', { schema: learningStatsSchema });
}

export async function getHistory(
  query: {
    cursor?: string;
    limit?: number;
  } = {},
): Promise<LessonHistoryPage> {
  const params = new URLSearchParams();
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();

  return apiFetch(`/me/history${qs === '' ? '' : `?${qs}`}`, {
    schema: lessonHistoryPageSchema,
  });
}

/**
 * Todo o histórico, em uma lista só — dá o status (concluída/em andamento)
 * de cada lição pro catálogo. Teto de páginas: o histórico de um aluno pode
 * crescer sem limite (ao contrário do catálogo, que é pequeno), então isto
 * é uma aproximação — cobre o uso real de hoje, não um sync exaustivo.
 */
export async function getRecentHistory(
  maxPages = 5,
): Promise<LessonHistoryPage['data']> {
  const entries: LessonHistoryPage['data'] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await getHistory({ cursor, limit: 100 });
    entries.push(...result.data);

    if (!result.hasMore || result.nextCursor === null) {
      break;
    }

    cursor = result.nextCursor;
  }

  return entries;
}
