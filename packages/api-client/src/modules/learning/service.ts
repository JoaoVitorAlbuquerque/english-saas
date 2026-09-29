import { apiFetch } from '../../http/fetch-client';
import { learningStatsSchema, type LearningStats } from './schemas';

export async function getStats(): Promise<LearningStats> {
  return apiFetch('/me/stats', { schema: learningStatsSchema });
}
